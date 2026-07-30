import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { formatDuration } from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'
import type { Punch, PunchDraft } from '@/types/attendance'

/**
 * ストアのテスト。
 *
 * コンポーネントをマウントせずに検証できる。これは「ストアが API と状態を持ち、
 * コンポーネントは描画だけを行う」構成にした見返りである（docs/03）。
 *
 * `createTestingPinia` は使わない。あれはアクションを差し替えてコンポーネントを
 * 隔離するためのもので、ここで確かめたいのはアクションそのものの挙動である。
 */

const KEY = 'timecard.punches.v1'
const DATE = '2026-05-11'

/** 保存済みのデータを用意する。ストアは生成時にこれを読み込む。 */
function seed(punches: readonly Punch[]): void {
  localStorage.setItem(KEY, JSON.stringify(punches))
}

/** localStorage に保存されている打刻を読み出す。 */
function stored(): Punch[] {
  return JSON.parse(localStorage.getItem(KEY) ?? '[]') as Punch[]
}

beforeEach(() => {
  localStorage.clear()
  // ストアごとに独立した Pinia を用意し、前のテストの状態を持ち込まない
  setActivePinia(createPinia())
})

describe('起動時の読み込み', () => {
  it('保存済みの打刻を読み込む', () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    expect(store.punches).toHaveLength(1)
    expect(store.days).toHaveLength(1)
  })

  it('壊れたデータでも起動する', () => {
    localStorage.setItem(KEY, '{ こわれた')
    const store = useAttendanceStore()
    expect(store.punches).toEqual([])
    expect(store.error).toBeNull()
  })
})

describe('punch', () => {
  it('現在時刻で打刻する', () => {
    const store = useAttendanceStore()
    const at = new Date(2026, 4, 11, 9, 5).getTime()
    store.punch('clock-in', at)
    expect(store.punches).toHaveLength(1)
    expect(store.punches[0]?.at).toBe(`${DATE}T09:05`)
    expect(store.punches[0]?.type).toBe('clock-in')
  })

  it('打刻に id が付く', () => {
    const store = useAttendanceStore()
    store.punch('clock-in', new Date(2026, 4, 11, 9, 0).getTime())
    store.punch('clock-out', new Date(2026, 4, 11, 18, 0).getTime())
    const ids = store.punches.map((punch) => punch.id)
    expect(new Set(ids).size).toBe(2)
  })
})

describe('addPunch', () => {
  it('時刻を指定して追加できる', () => {
    const store = useAttendanceStore()
    expect(store.addPunch('clock-in', `${DATE}T09:00`)).toBe(true)
    expect(store.punches).toHaveLength(1)
  })

  it('不正な時刻を拒否してエラーを残す', () => {
    const store = useAttendanceStore()
    expect(store.addPunch('clock-in', '2026-02-31T09:00')).toBe(false)
    expect(store.punches).toEqual([])
    expect(store.error).not.toBeNull()
  })
})

describe('updatePunch', () => {
  it('種別と時刻を書き換える', () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    expect(store.updatePunch('a1', 'break-start', `${DATE}T12:00`)).toBe(true)
    expect(store.punches[0]).toEqual({ id: 'a1', type: 'break-start', at: `${DATE}T12:00` })
  })

  it('存在しない id なら false を返す', () => {
    const store = useAttendanceStore()
    expect(store.updatePunch('missing', 'clock-in', `${DATE}T09:00`)).toBe(false)
  })

  it('不正な時刻を拒否する', () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    expect(store.updatePunch('a1', 'clock-in', `${DATE}T25:00`)).toBe(false)
    expect(store.punches[0]?.at).toBe(`${DATE}T09:00`)
  })
})

describe('removePunch', () => {
  it('指定した打刻だけを消す', () => {
    seed([
      { id: 'a1', type: 'clock-in', at: `${DATE}T09:00` },
      { id: 'a2', type: 'clock-out', at: `${DATE}T18:00` },
    ])
    const store = useAttendanceStore()
    store.removePunch('a1')
    expect(store.punches.map((punch) => punch.id)).toEqual(['a2'])
  })
})

describe('replaceDay', () => {
  const drafts: PunchDraft[] = [
    { type: 'clock-in', at: `${DATE}T10:00` },
    { type: 'clock-out', at: `${DATE}T16:00` },
  ]

  it('その日の打刻を置き換える', () => {
    seed([
      { id: 'a1', type: 'clock-in', at: `${DATE}T09:00` },
      { id: 'a2', type: 'break-start', at: `${DATE}T12:00` },
      { id: 'a3', type: 'break-end', at: `${DATE}T12:45` },
      { id: 'a4', type: 'clock-out', at: `${DATE}T18:00` },
    ])
    const store = useAttendanceStore()
    expect(store.replaceDay(DATE, drafts)).toBe(true)
    expect(store.punches).toHaveLength(2)
    expect(store.punches.map((punch) => punch.at.slice(11))).toEqual(['10:00', '16:00'])
  })

  it('他の日は残す', () => {
    seed([
      { id: 'a1', type: 'clock-in', at: `${DATE}T09:00` },
      { id: 'b1', type: 'clock-in', at: '2026-05-12T09:00' },
    ])
    const store = useAttendanceStore()
    store.replaceDay(DATE, drafts)
    const dates = store.punches.map((punch) => punch.at.slice(0, 10))
    expect(dates.filter((date) => date === '2026-05-12')).toHaveLength(1)
  })

  it('空配列を渡すとその日の記録が消える', () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    store.replaceDay(DATE, [])
    expect(store.punches).toEqual([])
  })

  it('不正な時刻を含むなら何も変えない', () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    expect(store.replaceDay(DATE, [{ type: 'clock-in', at: `${DATE}T99:00` }])).toBe(false)
    expect(store.punches).toHaveLength(1)
    expect(store.error).not.toBeNull()
  })
})

describe('導出値', () => {
  it('打刻を追加すると集計が追随する', () => {
    const store = useAttendanceStore()
    store.addPunch('clock-in', `${DATE}T09:00`)
    store.addPunch('clock-out', `${DATE}T18:00`)
    expect(formatDuration(store.summaryFor(DATE).workedMs)).toBe('9時間0分')

    // 打刻を直すと、集計を触らなくても結果が変わる
    const id = store.punches[1]?.id ?? ''
    store.updatePunch(id, 'clock-out', `${DATE}T17:00`)
    expect(formatDuration(store.summaryFor(DATE).workedMs)).toBe('8時間0分')
  })

  it('打刻が無い日でも集計を返す', () => {
    const store = useAttendanceStore()
    const summary = store.summaryFor('2026-01-01')
    expect(summary.date).toBe('2026-01-01')
    expect(summary.workedMs).toBe(0)
  })

  it('月次集計を返す', () => {
    const store = useAttendanceStore()
    store.addPunch('clock-in', `${DATE}T09:00`)
    store.addPunch('clock-out', `${DATE}T18:00`)
    store.addPunch('clock-in', '2026-06-01T09:00')
    store.addPunch('clock-out', '2026-06-01T18:00')

    const may = store.monthSummaryFor('2026-05')
    expect(may.dayCount).toBe(1)
    expect(formatDuration(may.workedMs)).toBe('9時間0分')
    expect(store.monthSummaryFor('2026-07').dayCount).toBe(0)
  })
})

describe('永続化', () => {
  // watch による保存は同期ではないため、反映を待つ必要がある
  it('打刻の追加が保存される', async () => {
    const store = useAttendanceStore()
    store.addPunch('clock-in', `${DATE}T09:00`)
    await nextTick()
    expect(stored()).toHaveLength(1)
  })

  it('既存の打刻の書き換えも保存される', async () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    store.updatePunch('a1', 'clock-in', `${DATE}T08:30`)
    await nextTick()
    expect(stored()[0]?.at).toBe(`${DATE}T08:30`)
  })

  it('削除も保存される', async () => {
    seed([{ id: 'a1', type: 'clock-in', at: `${DATE}T09:00` }])
    const store = useAttendanceStore()
    store.removePunch('a1')
    await nextTick()
    expect(stored()).toEqual([])
  })

  it('保存に成功するとエラーが消える', async () => {
    const store = useAttendanceStore()
    store.addPunch('clock-in', '2026-02-31T09:00')
    expect(store.error).not.toBeNull()
    store.addPunch('clock-in', `${DATE}T09:00`)
    await nextTick()
    expect(store.error).toBeNull()
  })
})
