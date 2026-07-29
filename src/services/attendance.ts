import { parseDateTime, toClock, toDateKey, toDateTime, toMonthKey } from '@/services/time'
import type {
  DayEntry,
  DayEntryDraft,
  DayEntryResult,
  DaySummary,
  MonthSummary,
  Punch,
  PunchDraft,
  PunchIssue,
  PunchType,
  WorkStatus,
} from '@/types/attendance'

/**
 * 打刻列から勤務時間を導出する集計処理。本アプリケーションの中核であり、Vue を
 * 含まない純粋な TypeScript として単体テストできる。
 *
 * 現在時刻を参照しない点が重要である。区切られていない区間（退勤していない勤務
 * など）は経過時間に加算せず、不整合として報告するだけにとどめる。これにより
 * 集計は入力だけで決まる純粋な関数となり、実時間の経過による表示は呼び出し側の
 * 責務に分離される。
 */

/**
 * 打刻を時刻順に並べ替える。
 *
 * 時刻は桁数の固定された文字列であるため、辞書順の比較がそのまま時刻順になる。
 *
 * @param punches - 並べ替える打刻
 * @returns 時刻の昇順に並んだ新しい配列
 */
function sortByTime(punches: readonly Punch[]): Punch[] {
  return [...punches].sort((a, b) => a.at.localeCompare(b.at))
}

/**
 * 同じ種類の不整合を 1 件にまとめる。
 *
 * @param issues - 検出した不整合
 * @returns 種類ごとに 1 件だけ残した配列
 */
function dedupeIssues(issues: readonly PunchIssue[]): PunchIssue[] {
  return issues.filter(
    (issue, index) => issues.findIndex((other) => other.kind === issue.kind) === index,
  )
}

/**
 * 1 日分の打刻を集計する。
 *
 * 打刻を時刻順にたどり、出勤と退勤の対から在社時間を、休憩開始と休憩終了の対から
 * 休憩時間を積み上げる。対にならない打刻は不整合として記録する。中抜けなどで
 * 1 日に複数回の出退勤があっても、対ごとに加算するため正しく合計される。
 *
 * @param date - 対象の日付キー "YYYY-MM-DD"
 * @param punches - その日の打刻。順序は問わない
 * @returns 集計結果
 */
export function summarizeDay(date: string, punches: readonly Punch[]): DaySummary {
  const ordered = sortByTime(punches)
  const issues: PunchIssue[] = []

  let presentMs = 0
  let breakMs = 0
  let workStart: number | undefined
  let breakStart: number | undefined
  let status: WorkStatus = 'before-work'
  let openSince: string | undefined

  for (const punch of ordered) {
    const at = parseDateTime(punch.at)
    if (at === undefined) {
      // 解析できない時刻は保存時に弾いているため通常は現れない。ここで無視して
      // おけば、万一混入しても集計全体が壊れることはない。
      continue
    }

    switch (punch.type) {
      case 'clock-in':
        if (workStart !== undefined) {
          issues.push({ kind: 'unclosed-work' })
        }
        workStart = at
        openSince = punch.at
        status = 'working'
        break

      case 'break-start':
        if (breakStart !== undefined) {
          issues.push({ kind: 'unclosed-break' })
        }
        breakStart = at
        openSince = punch.at
        status = 'on-break'
        break

      case 'break-end':
        if (breakStart === undefined) {
          issues.push({ kind: 'orphan-break-end' })
        } else {
          breakMs += at - breakStart
          breakStart = undefined
        }
        openSince = punch.at
        status = 'working'
        break

      case 'clock-out':
        if (workStart === undefined) {
          issues.push({ kind: 'orphan-clock-out' })
        } else {
          presentMs += at - workStart
          workStart = undefined
        }
        openSince = undefined
        status = 'after-work'
        break
    }
  }

  // 最後まで対にならなかった区間は、経過時間に加えずに不整合として報告する。
  if (workStart !== undefined) {
    issues.push({ kind: 'unclosed-work' })
  }
  if (breakStart !== undefined) {
    issues.push({ kind: 'unclosed-break' })
  }

  return {
    date,
    punches: ordered,
    presentMs,
    breakMs,
    workedMs: Math.max(0, presentMs - breakMs),
    status,
    openSince,
    issues: dedupeIssues(issues),
  }
}

/**
 * 打刻をすべて日付ごとに集計する。
 *
 * @param punches - 全期間の打刻
 * @returns 日付の降順（新しい日が先頭）に並んだ集計結果
 */
export function summarizeByDate(punches: readonly Punch[]): DaySummary[] {
  const dates = [...new Set(punches.map((punch) => toDateKey(punch.at)))]
  return dates
    .sort((a, b) => b.localeCompare(a))
    .map((date) =>
      summarizeDay(
        date,
        punches.filter((punch) => toDateKey(punch.at) === date),
      ),
    )
}

/**
 * 1 か月分を集計する。
 *
 * 日ごとの集計を受け取って合算するだけであり、打刻から数え直すことはしない。
 * 同じ計算を二重に持たないため、日次と月次で結果が食い違うことがない。
 *
 * @param month - 対象の月キー "YYYY-MM"
 * @param days - 全期間の日次集計。順序は問わない
 * @returns 集計結果。対象月に打刻が無い場合も、0 が並んだ結果を返す
 */
export function summarizeMonth(month: string, days: readonly DaySummary[]): MonthSummary {
  // 月内は日付の昇順で見るほうが、勤務の流れを追いやすい。
  const inMonth = days
    .filter((day) => toMonthKey(day.date) === month)
    .sort((a, b) => a.date.localeCompare(b.date))

  const presentMs = inMonth.reduce((total, day) => total + day.presentMs, 0)
  const breakMs = inMonth.reduce((total, day) => total + day.breakMs, 0)
  const workedMs = inMonth.reduce((total, day) => total + day.workedMs, 0)
  const dayCount = inMonth.length

  return {
    month,
    days: inMonth,
    presentMs,
    breakMs,
    workedMs,
    dayCount,
    issueDayCount: inMonth.filter((day) => 0 < day.issues.length).length,
    averageWorkedMs: dayCount < 1 ? 0 : Math.round(workedMs / dayCount),
  }
}

/**
 * 既存の打刻を 1 日分の入力形式へ変換する。まとめて修正するときの初期値になる。
 *
 * この形式は出勤・休憩・退勤を 1 組ずつしか持てない。同じ種別が複数ある日は
 * すべてを表せないため、出勤は最も早いもの、退勤は最も遅いもの、休憩は最初の
 * 組を採り、情報が落ちることを `isLossy` で知らせる。呼び出し側はこれを利用者に
 * 提示できる。黙って一部だけ拾うと、保存した時点で残りが消えてしまう。
 *
 * @param date - 対象の日付キー "YYYY-MM-DD"
 * @param punches - その日の打刻
 * @returns 入力形式へ変換した結果
 */
export function toDayEntry(date: string, punches: readonly Punch[]): DayEntryDraft {
  /**
   * 指定した種別の時刻を昇順で取り出す。
   *
   * @param type - 打刻の種別
   * @returns "HH:mm" の配列
   */
  function clocksOf(type: PunchType): string[] {
    return punches
      .filter((punch) => punch.type === type)
      .map((punch) => toClock(punch.at))
      .sort((a, b) => a.localeCompare(b))
  }

  const clockIns = clocksOf('clock-in')
  const clockOuts = clocksOf('clock-out')
  const breakStarts = clocksOf('break-start')
  const breakEnds = clocksOf('break-end')

  return {
    entry: {
      date,
      // 出勤は最も早い時刻、退勤は最も遅い時刻を採る。中抜けがある日でも、
      // その日の始まりと終わりとしては妥当な値になる。
      clockIn: clockIns[0] ?? '',
      clockOut: clockOuts[clockOuts.length - 1] ?? '',
      breakStart: breakStarts[0] ?? '',
      breakEnd: breakEnds[0] ?? '',
    },
    isLossy: [clockIns, clockOuts, breakStarts, breakEnds].some((clocks) => 1 < clocks.length),
  }
}

/**
 * 1 日分の入力を打刻の列へ変換する。
 *
 * 出勤から退勤までをまとめて受け取り、順序の矛盾があれば打刻を作らずに指摘を返す。
 * 4 件を 1 件ずつ追加する場合、途中の状態では「退勤がない」と警告が出るうえ、
 * 入力を終えるまで矛盾に気づけない。まとめて検証することで、保存前に指摘できる。
 *
 * 時刻は桁数が固定された "HH:mm" 形式であるため、辞書順の比較がそのまま時刻の
 * 前後関係になる。
 *
 * @param entry - フォームの入力値。休憩は未入力なら空文字
 * @returns 変換した打刻、または最初に見つかった指摘
 */
export function buildDayPunches(entry: DayEntry): DayEntryResult {
  const { date, clockIn, clockOut, breakStart, breakEnd } = entry

  const hasBreakStart = 0 < breakStart.length
  const hasBreakEnd = 0 < breakEnd.length
  if (hasBreakStart !== hasBreakEnd) {
    return { ok: false, issue: { kind: 'incomplete-break' } }
  }

  // 比較は小さい順に並べて条件が数直線と同じ向きになるようにし、満たすべき条件を
  // 変数にしてから否定する（docs/05 §12）。
  const isWorkOrdered = clockIn < clockOut
  if (!isWorkOrdered) {
    return { ok: false, issue: { kind: 'clock-out-not-after-in' } }
  }

  if (hasBreakStart) {
    const isBreakOrdered = breakStart < breakEnd
    if (!isBreakOrdered) {
      return { ok: false, issue: { kind: 'break-end-not-after-start' } }
    }
    const isBreakInsideWork = clockIn <= breakStart && breakEnd <= clockOut
    if (!isBreakInsideWork) {
      return { ok: false, issue: { kind: 'break-outside-work' } }
    }
  }

  const punches: PunchDraft[] = [{ type: 'clock-in', at: toDateTime(date, clockIn) }]
  if (hasBreakStart) {
    punches.push({ type: 'break-start', at: toDateTime(date, breakStart) })
    punches.push({ type: 'break-end', at: toDateTime(date, breakEnd) })
  }
  punches.push({ type: 'clock-out', at: toDateTime(date, clockOut) })

  return { ok: true, punches }
}

/**
 * 現在の勤務状態から、次に打刻できる種別を返す。
 *
 * 退勤後にも出勤を許すのは、中抜けからの再出勤を記録できるようにするためである。
 *
 * @param status - 現在の勤務状態
 * @returns 打刻できる種別
 */
export function allowedPunchTypes(status: WorkStatus): readonly PunchType[] {
  switch (status) {
    case 'before-work':
      return ['clock-in']
    case 'working':
      return ['break-start', 'clock-out']
    case 'on-break':
      return ['break-end']
    case 'after-work':
      return ['clock-in']
  }
}
