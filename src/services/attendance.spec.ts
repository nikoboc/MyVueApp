import { describe, expect, it } from 'vitest'

import {
  allowedPunchTypes,
  buildDayPunches,
  summarizeByDate,
  summarizeDay,
  summarizeMonth,
  toDayEntry,
} from '@/services/attendance'
import { formatDuration } from '@/services/time'
import type { BreakEntry, DayEntry, Punch, PunchDraft, PunchType } from '@/types/attendance'

/**
 * 集計処理のテスト。本アプリケーションの中核であり、Vue を含まないため
 * コンポーネントをマウントせずに検証できる。
 */

const DATE = '2026-05-11'

/**
 * 打刻を組み立てる。
 *
 * @param type - 打刻の種別
 * @param clock - "HH:mm" 形式の時刻
 * @param date - 日付キー。既定は DATE
 */
function punch(type: PunchType, clock: string, date = DATE): Punch {
  return { id: `${date}-${type}-${clock}`, type, at: `${date}T${clock}` }
}

/** 出勤 9:00・休憩 12:00-12:45・退勤 18:00 の 1 日（実働 8時間15分）。 */
function normalDay(date = DATE): Punch[] {
  return [
    punch('clock-in', '09:00', date),
    punch('break-start', '12:00', date),
    punch('break-end', '12:45', date),
    punch('clock-out', '18:00', date),
  ]
}

/** 検出された不整合の種類だけを取り出す。 */
const issueKinds = (punches: readonly Punch[]): string[] =>
  summarizeDay(DATE, punches).issues.map((issue) => issue.kind)

describe('summarizeDay', () => {
  it('出勤から退勤までを集計する', () => {
    const summary = summarizeDay(DATE, normalDay())
    expect(formatDuration(summary.presentMs)).toBe('9時間0分')
    expect(formatDuration(summary.breakMs)).toBe('45分')
    expect(formatDuration(summary.workedMs)).toBe('8時間15分')
    expect(summary.status).toBe('after-work')
    expect(summary.issues).toEqual([])
    expect(summary.openSince).toBeUndefined()
  })

  it('渡す順序に依存しない', () => {
    const shuffled = [
      punch('clock-out', '18:00'),
      punch('break-end', '12:45'),
      punch('clock-in', '09:00'),
      punch('break-start', '12:00'),
    ]
    const summary = summarizeDay(DATE, shuffled)
    expect(formatDuration(summary.workedMs)).toBe('8時間15分')
    expect(summary.punches[0]?.type).toBe('clock-in')
  })

  // 現在時刻を参照しない設計のため、進行中の区間は加算せず不整合として報告する
  it('退勤していない勤務は加算せず不整合として報告する', () => {
    const summary = summarizeDay(DATE, [punch('clock-in', '09:00')])
    expect(summary.status).toBe('working')
    expect(summary.workedMs).toBe(0)
    expect(summary.openSince).toBe(`${DATE}T09:00`)
    expect(summary.issues).toEqual([{ kind: 'unclosed-work' }])
  })

  it('休憩中の状態を判定する', () => {
    const summary = summarizeDay(DATE, [punch('clock-in', '09:00'), punch('break-start', '12:00')])
    expect(summary.status).toBe('on-break')
    expect(summary.openSince).toBe(`${DATE}T12:00`)
    expect(summary.issues).toHaveLength(2)
  })

  it('中抜けは対ごとに加算する', () => {
    const summary = summarizeDay(DATE, [
      punch('clock-in', '09:00'),
      punch('clock-out', '12:00'),
      punch('clock-in', '13:00'),
      punch('clock-out', '18:00'),
    ])
    expect(formatDuration(summary.presentMs)).toBe('8時間0分')
    expect(formatDuration(summary.workedMs)).toBe('8時間0分')
    expect(summary.issues).toEqual([])
  })

  it('対にならない打刻を報告する', () => {
    expect(issueKinds([punch('clock-out', '18:00')])).toEqual(['orphan-clock-out'])
    expect(issueKinds([punch('clock-in', '09:00'), punch('break-end', '12:45')])).toContain(
      'orphan-break-end',
    )
  })

  it('同じ種類の不整合は 1 件にまとめる', () => {
    const kinds = issueKinds([
      punch('clock-out', '08:00'),
      punch('clock-out', '18:00'),
      punch('clock-out', '19:00'),
    ])
    expect(kinds).toEqual(['orphan-clock-out'])
  })

  it('打刻が無い日も集計を返す', () => {
    const summary = summarizeDay(DATE, [])
    expect(summary.status).toBe('before-work')
    expect(summary.workedMs).toBe(0)
    expect(summary.issues).toEqual([])
  })
})

describe('allowedPunchTypes', () => {
  it('勤務状態ごとに打刻できる種別を返す', () => {
    expect(allowedPunchTypes('before-work')).toEqual(['clock-in'])
    expect(allowedPunchTypes('working')).toEqual(['break-start', 'clock-out'])
    expect(allowedPunchTypes('on-break')).toEqual(['break-end'])
    // 中抜けからの再出勤を許すため、退勤済みでも出勤できる
    expect(allowedPunchTypes('after-work')).toEqual(['clock-in'])
  })
})

describe('summarizeByDate', () => {
  it('日付の降順で日ごとに集計する', () => {
    const days = summarizeByDate([
      ...normalDay('2026-05-11'),
      ...normalDay('2026-05-13'),
      ...normalDay('2026-05-12'),
    ])
    expect(days.map((day) => day.date)).toEqual(['2026-05-13', '2026-05-12', '2026-05-11'])
  })
})

describe('summarizeMonth', () => {
  it('日ごとの集計を合算する', () => {
    const days = summarizeByDate([
      ...normalDay('2026-05-01'),
      ...normalDay('2026-05-02'),
      ...normalDay('2026-05-31'),
    ])
    const month = summarizeMonth('2026-05', days)
    expect(month.dayCount).toBe(3)
    expect(formatDuration(month.workedMs)).toBe('24時間45分')
    expect(formatDuration(month.breakMs)).toBe('2時間15分')
    expect(formatDuration(month.averageWorkedMs)).toBe('8時間15分')
    expect(month.issueDayCount).toBe(0)
    // 月内は古い順に並べる
    expect(month.days.map((day) => day.date)).toEqual([
      '2026-05-01',
      '2026-05-02',
      '2026-05-31',
    ])
  })

  it('他の月を含めない', () => {
    const days = summarizeByDate([
      ...normalDay('2026-04-30'),
      ...normalDay('2026-05-01'),
      ...normalDay('2026-06-01'),
    ])
    expect(summarizeMonth('2026-05', days).dayCount).toBe(1)
    expect(summarizeMonth('2026-04', days).dayCount).toBe(1)
  })

  it('打刻が無い月でも 0 の集計を返す', () => {
    const month = summarizeMonth('2026-09', summarizeByDate(normalDay()))
    expect(month.dayCount).toBe(0)
    expect(month.workedMs).toBe(0)
    // 0 除算にならないこと
    expect(month.averageWorkedMs).toBe(0)
    expect(month.days).toEqual([])
  })

  it('不整合のある日を数える', () => {
    const days = summarizeByDate([
      ...normalDay('2026-05-01'),
      punch('clock-in', '09:00', '2026-05-02'),
    ])
    const month = summarizeMonth('2026-05', days)
    expect(month.dayCount).toBe(2)
    expect(month.issueDayCount).toBe(1)
    // 退勤のない日は実働に加算されない
    expect(formatDuration(month.workedMs)).toBe('8時間15分')
  })

  // 同じ計算を二重に持たない設計であることの確認
  it('日次の合計と一致する', () => {
    const days = summarizeByDate([...normalDay('2026-05-01'), ...normalDay('2026-05-02')])
    const manual = days.reduce((total, day) => total + day.workedMs, 0)
    expect(summarizeMonth('2026-05', days).workedMs).toBe(manual)
  })
})

describe('buildDayPunches', () => {
  /** 既定値をもとに入力を作る。 */
  function entry(breaks: BreakEntry[], over: Partial<DayEntry> = {}): DayEntry {
    return { date: DATE, clockIn: '09:00', clockOut: '18:00', breaks, ...over }
  }

  /** 指摘の種類、または成功なら 'ok' を返す。 */
  function kindOf(value: DayEntry): string {
    const result = buildDayPunches(value)
    return result.ok ? 'ok' : result.issue.kind
  }

  /** 生成された打刻を集計まで通す。 */
  function summarize(value: DayEntry) {
    const result = buildDayPunches(value)
    if (!result.ok) {
      throw new Error(`成功を期待したが ${result.issue.kind} が返った`)
    }
    const punches: Punch[] = result.punches.map((draft: PunchDraft, index: number) => ({
      id: `r${index}`,
      type: draft.type,
      at: draft.at,
    }))
    return summarizeDay(value.date, punches)
  }

  it('休憩なしで出勤と退勤だけを作る', () => {
    const result = buildDayPunches(entry([]))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.punches.map((draft) => draft.type)).toEqual(['clock-in', 'clock-out'])
    }
    expect(formatDuration(summarize(entry([])).workedMs)).toBe('9時間0分')
  })

  it('休憩を複数回作れる', () => {
    const value = entry([
      { start: '12:00', end: '12:45' },
      { start: '15:00', end: '15:15' },
    ])
    const result = buildDayPunches(value)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.punches).toHaveLength(6)
    }
    expect(formatDuration(summarize(value).breakMs)).toBe('1時間0分')
    expect(formatDuration(summarize(value).workedMs)).toBe('8時間0分')
  })

  it('入力順が前後していても時刻順に並べる', () => {
    const result = buildDayPunches(
      entry([
        { start: '15:00', end: '15:15' },
        { start: '10:30', end: '10:40' },
        { start: '12:00', end: '12:45' },
      ]),
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.punches.map((draft) => draft.at.slice(11))).toEqual([
        '09:00',
        '10:30',
        '10:40',
        '12:00',
        '12:45',
        '15:00',
        '15:15',
        '18:00',
      ])
    }
  })

  it('両方が空欄の休憩は無視する', () => {
    expect(kindOf(entry([{ start: '', end: '' }]))).toBe('ok')
    expect(
      kindOf(entry([{ start: '12:00', end: '12:45' }, { start: '', end: '' }])),
    ).toBe('ok')
    expect(
      formatDuration(summarize(entry([{ start: '12:00', end: '12:45' }, { start: '', end: '' }])).breakMs),
    ).toBe('45分')
  })

  it('片方だけ入力された休憩を拒否する', () => {
    expect(kindOf(entry([{ start: '12:00', end: '' }]))).toBe('incomplete-break')
    expect(kindOf(entry([{ start: '', end: '12:45' }]))).toBe('incomplete-break')
    expect(
      kindOf(entry([{ start: '12:00', end: '12:45' }, { start: '15:00', end: '' }])),
    ).toBe('incomplete-break')
  })

  it('退勤が出勤より後でなければ拒否する', () => {
    expect(kindOf(entry([], { clockIn: '18:00', clockOut: '09:00' }))).toBe(
      'clock-out-not-after-in',
    )
    expect(kindOf(entry([], { clockIn: '09:00', clockOut: '09:00' }))).toBe(
      'clock-out-not-after-in',
    )
  })

  it('休憩の前後が逆なら拒否する', () => {
    expect(kindOf(entry([{ start: '13:00', end: '12:00' }]))).toBe('break-end-not-after-start')
  })

  it('勤務時間の外にある休憩を拒否する', () => {
    expect(kindOf(entry([{ start: '08:00', end: '08:30' }]))).toBe('break-outside-work')
    expect(kindOf(entry([{ start: '19:00', end: '19:30' }]))).toBe('break-outside-work')
    expect(kindOf(entry([{ start: '17:30', end: '18:30' }]))).toBe('break-outside-work')
  })

  it('出退勤と同時刻の休憩は許容する', () => {
    expect(kindOf(entry([{ start: '09:00', end: '10:00' }]))).toBe('ok')
    expect(kindOf(entry([{ start: '17:00', end: '18:00' }]))).toBe('ok')
  })

  // 重なりを許すとその時間を二重に引き、実働が短く出てしまう
  it('休憩の重なりを拒否する', () => {
    expect(
      kindOf(entry([{ start: '12:00', end: '13:00' }, { start: '12:30', end: '13:30' }])),
    ).toBe('breaks-overlap')
    expect(
      kindOf(entry([{ start: '12:00', end: '14:00' }, { start: '12:30', end: '13:00' }])),
    ).toBe('breaks-overlap')
    expect(
      kindOf(entry([{ start: '12:00', end: '13:00' }, { start: '12:00', end: '13:00' }])),
    ).toBe('breaks-overlap')
  })

  it('境界で接する休憩は許容する', () => {
    expect(
      kindOf(entry([{ start: '12:00', end: '13:00' }, { start: '13:00', end: '13:30' }])),
    ).toBe('ok')
  })

  // 現在の入力形式では深夜勤務を表せない。仕様として固定しておく
  it('日をまたぐ勤務は表せない', () => {
    expect(kindOf(entry([], { clockIn: '22:00', clockOut: '06:00' }))).toBe(
      'clock-out-not-after-in',
    )
  })
})

describe('toDayEntry', () => {
  it('通常の 1 日は往復できる', () => {
    const punches = normalDay()
    const draft = toDayEntry(DATE, punches)
    expect(draft.entry).toEqual({
      date: DATE,
      clockIn: '09:00',
      clockOut: '18:00',
      breaks: [{ start: '12:00', end: '12:45' }],
    })
    expect(draft.isLossy).toBe(false)

    const rebuilt = buildDayPunches(draft.entry)
    expect(rebuilt.ok).toBe(true)
    if (rebuilt.ok) {
      expect(rebuilt.punches.map((draftPunch) => `${draftPunch.type}@${draftPunch.at}`)).toEqual(
        punches.map((original) => `${original.type}@${original.at}`),
      )
    }
  })

  it('休憩を複数拾う', () => {
    const draft = toDayEntry(DATE, [
      punch('clock-in', '09:00'),
      punch('break-start', '12:00'),
      punch('break-end', '12:45'),
      punch('break-start', '15:00'),
      punch('break-end', '15:15'),
      punch('clock-out', '18:00'),
    ])
    expect(draft.entry.breaks).toEqual([
      { start: '12:00', end: '12:45' },
      { start: '15:00', end: '15:15' },
    ])
    expect(draft.isLossy).toBe(false)
  })

  it('打刻の並び順に依存しない', () => {
    const draft = toDayEntry(DATE, [
      punch('clock-out', '18:00'),
      punch('break-end', '12:45'),
      punch('clock-in', '09:00'),
      punch('break-start', '12:00'),
    ])
    expect(draft.entry.clockIn).toBe('09:00')
    expect(draft.entry.clockOut).toBe('18:00')
    expect(draft.entry.breaks).toEqual([{ start: '12:00', end: '12:45' }])
  })

  it('欠けている打刻は空文字にする', () => {
    expect(toDayEntry(DATE, [punch('clock-in', '09:00')]).entry.clockOut).toBe('')
    expect(toDayEntry(DATE, []).entry).toEqual({
      date: DATE,
      clockIn: '',
      clockOut: '',
      breaks: [],
    })
  })

  it('中抜けは表しきれないと報告する', () => {
    const draft = toDayEntry(DATE, [
      punch('clock-in', '09:00'),
      punch('clock-out', '12:00'),
      punch('clock-in', '13:00'),
      punch('clock-out', '18:00'),
    ])
    // 出勤は最も早い時刻、退勤は最も遅い時刻を採る
    expect(draft.entry.clockIn).toBe('09:00')
    expect(draft.entry.clockOut).toBe('18:00')
    expect(draft.isLossy).toBe(true)
  })

  // 表しきれない日を保存すると実働が変わってしまうことの確認
  it('中抜けの日は変換で実働が変わる', () => {
    const punches = [
      punch('clock-in', '09:00'),
      punch('clock-out', '12:00'),
      punch('clock-in', '13:00'),
      punch('clock-out', '18:00'),
    ]
    expect(formatDuration(summarizeDay(DATE, punches).workedMs)).toBe('8時間0分')

    const rebuilt = buildDayPunches(toDayEntry(DATE, punches).entry)
    expect(rebuilt.ok).toBe(true)
    if (rebuilt.ok) {
      const after = summarizeDay(
        DATE,
        rebuilt.punches.map((draft, index) => ({ id: `r${index}`, ...draft })),
      )
      expect(formatDuration(after.workedMs)).toBe('9時間0分')
    }
  })

  it('対にならない休憩は表しきれないと報告する', () => {
    expect(
      toDayEntry(DATE, [punch('clock-in', '09:00'), punch('break-start', '12:00'), punch('clock-out', '18:00')])
        .isLossy,
    ).toBe(true)
    expect(
      toDayEntry(DATE, [punch('clock-in', '09:00'), punch('break-end', '12:45'), punch('clock-out', '18:00')])
        .isLossy,
    ).toBe(true)
  })

  it('休憩が何回あっても表せる', () => {
    const draft = toDayEntry(DATE, [
      punch('clock-in', '09:00'),
      punch('break-start', '10:00'),
      punch('break-end', '10:10'),
      punch('break-start', '12:00'),
      punch('break-end', '12:45'),
      punch('break-start', '15:00'),
      punch('break-end', '15:15'),
      punch('clock-out', '18:00'),
    ])
    expect(draft.entry.breaks).toHaveLength(3)
    expect(draft.isLossy).toBe(false)
  })
})
