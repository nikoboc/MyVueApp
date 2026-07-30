import { describe, expect, it } from 'vitest'

import {
  currentMonthKey,
  formatDateLabel,
  formatDateTime,
  formatDayInMonthLabel,
  formatDuration,
  formatMonthLabel,
  isDateTimeString,
  isMonthKey,
  parseDateTime,
  shiftMonth,
  toClock,
  toDateKey,
  toDateTime,
  todayKey,
  toMonthKey,
} from '@/services/time'

/**
 * 日時の解析と整形のテスト。
 *
 * ここは Vue に依存しない純粋関数の集まりなので、コンポーネントをマウントせずに
 * 引数と戻り値だけで検証できる（docs/02 の設計方針）。
 */

describe('parseDateTime', () => {
  it('正しい形式をエポックミリ秒へ変換する', () => {
    const ms = parseDateTime('2026-07-29T09:02')
    expect(ms).not.toBeUndefined()
    // ローカル時刻として解釈されることを、生成した Date から読み戻して確かめる
    const date = new Date(ms as number)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(29)
    expect(date.getHours()).toBe(9)
    expect(date.getMinutes()).toBe(2)
  })

  it('うるう日を受け付ける', () => {
    expect(parseDateTime('2024-02-29T10:00')).not.toBeUndefined()
  })

  // Date は繰り上げてしまうため、往復で確認しないと通り抜ける
  it('実在しない日付を拒否する', () => {
    expect(parseDateTime('2026-02-31T10:00')).toBeUndefined()
    expect(parseDateTime('2026-04-31T10:00')).toBeUndefined()
    expect(parseDateTime('2025-02-29T10:00')).toBeUndefined()
  })

  it('範囲外の時刻を拒否する', () => {
    expect(parseDateTime('2026-07-29T24:00')).toBeUndefined()
    expect(parseDateTime('2026-07-29T10:60')).toBeUndefined()
  })

  it('形式が違うものを拒否する', () => {
    expect(parseDateTime('2026/07/29 10:00')).toBeUndefined()
    expect(parseDateTime('2026-07-29')).toBeUndefined()
    expect(parseDateTime('2026-07-29T10:00:00')).toBeUndefined()
    expect(parseDateTime('')).toBeUndefined()
  })
})

describe('formatDateTime', () => {
  it('parseDateTime と往復できる', () => {
    const value = '2026-07-29T09:02'
    expect(formatDateTime(parseDateTime(value) as number)).toBe(value)
  })

  it('1 桁の月日時分を 0 埋めする', () => {
    const ms = parseDateTime('2026-01-02T03:04') as number
    expect(formatDateTime(ms)).toBe('2026-01-02T03:04')
  })
})

describe('isDateTimeString', () => {
  it('parseDateTime と同じ判定になる', () => {
    expect(isDateTimeString('2026-07-29T09:02')).toBe(true)
    expect(isDateTimeString('2026-02-31T09:02')).toBe(false)
  })
})

describe('日付と時刻の切り出し', () => {
  it('日付キーと時刻を取り出す', () => {
    expect(toDateKey('2026-07-29T09:02')).toBe('2026-07-29')
    expect(toClock('2026-07-29T09:02')).toBe('09:02')
  })

  it('日付と時刻を組み立てる', () => {
    expect(toDateTime('2026-07-29', '09:02')).toBe('2026-07-29T09:02')
  })

  it('現在時刻から日付キーと月キーを求める', () => {
    const ms = parseDateTime('2026-07-29T23:59') as number
    expect(todayKey(ms)).toBe('2026-07-29')
    expect(currentMonthKey(ms)).toBe('2026-07')
  })
})

describe('formatDuration', () => {
  it('1 時間未満は分だけで表す', () => {
    expect(formatDuration(0)).toBe('0分')
    expect(formatDuration(45 * 60_000)).toBe('45分')
  })

  it('1 時間以上は時間と分で表す', () => {
    expect(formatDuration(60 * 60_000)).toBe('1時間0分')
    expect(formatDuration((8 * 60 + 15) * 60_000)).toBe('8時間15分')
    expect(formatDuration((12 * 60 + 45) * 60_000)).toBe('12時間45分')
  })

  it('負の値は 0 として扱う', () => {
    expect(formatDuration(-5000)).toBe('0分')
  })

  it('秒は切り捨てる', () => {
    expect(formatDuration(59_999)).toBe('0分')
  })
})

describe('月キーの操作', () => {
  it('日付キーと打刻時刻から月キーを取り出す', () => {
    expect(toMonthKey('2026-07-29')).toBe('2026-07')
    expect(toMonthKey('2026-07-29T09:00')).toBe('2026-07')
  })

  it('年をまたいで移動できる', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-07', 0)).toBe('2026-07')
    expect(shiftMonth('2026-07', 12)).toBe('2027-07')
    expect(shiftMonth('2026-07', -7)).toBe('2025-12')
  })

  it('解析できない入力はそのまま返す', () => {
    expect(shiftMonth('こわれた', 1)).toBe('こわれた')
    expect(formatMonthLabel('こわれた')).toBe('こわれた')
  })

  // URL から来る値をそのまま使わないための検証
  it('月キーの形式を判定する', () => {
    expect(isMonthKey('2026-07')).toBe(true)
    expect(isMonthKey('2026-01')).toBe(true)
    expect(isMonthKey('2026-12')).toBe(true)
    expect(isMonthKey('2026-00')).toBe(false)
    expect(isMonthKey('2026-13')).toBe(false)
    expect(isMonthKey('2026-07-29')).toBe(false)
    expect(isMonthKey('2026/07')).toBe(false)
    expect(isMonthKey('')).toBe(false)
  })
})

describe('表示用のラベル', () => {
  it('日付を年月日と曜日で表す', () => {
    expect(formatDateLabel('2026-07-29')).toBe('2026年7月29日(水)')
  })

  it('月の中では日と曜日だけで表す', () => {
    expect(formatDayInMonthLabel('2026-07-29')).toBe('29日(水)')
    expect(formatDayInMonthLabel('2026-07-01')).toBe('1日(水)')
  })

  it('月を年月で表す', () => {
    expect(formatMonthLabel('2026-07')).toBe('2026年7月')
    expect(formatMonthLabel('2026-01')).toBe('2026年1月')
  })

  it('解析できない日付はそのまま返す', () => {
    expect(formatDateLabel('2026-02-31')).toBe('2026-02-31')
    expect(formatDayInMonthLabel('こわれた')).toBe('こわれた')
  })
})
