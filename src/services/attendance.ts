import { parseDateTime, toDateKey } from '@/services/time'
import type { DaySummary, Punch, PunchIssue, PunchType, WorkStatus } from '@/types/attendance'

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
