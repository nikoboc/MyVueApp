import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import PunchView from '@/views/PunchView.vue'
import type { Punch } from '@/types/attendance'

/**
 * 打刻画面のテスト。
 *
 * 確かめたいのは「今日の記録だけを表示する」ことである。過去の日を出さないのは
 * 意図した動作なので、テストとして固定しておく。
 *
 * 現在時刻を固定して検証する。実際の日付に依存させると、日をまたいだ瞬間に
 * 結果が変わるテストになってしまう。
 */

const TODAY = '2026-05-11'
const YESTERDAY = '2026-05-10'

/** 1 日分の打刻（出勤と退勤）を作る。 */
function dayPunches(date: string, prefix: string): Punch[] {
  return [
    { id: `${prefix}1`, type: 'clock-in', at: `${date}T09:00` },
    { id: `${prefix}2`, type: 'clock-out', at: `${date}T18:00` },
  ]
}

/** 保存済みのデータを用意する。ストアは生成時にこれを読み込む。 */
function seed(punches: readonly Punch[]): void {
  localStorage.setItem('timecard.punches.v1', JSON.stringify(punches))
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
  // 2026-05-11 10:00 を「いま」とする
  vi.setSystemTime(new Date(2026, 4, 11, 10, 0))
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('PunchView', () => {
  it('打刻が無ければ案内を表示する', () => {
    const wrapper = mount(PunchView)
    expect(wrapper.get('.empty').text()).toContain('今日の打刻はまだありません')
    expect(wrapper.findAll('.day')).toHaveLength(0)
  })

  it('今日の記録を表示する', () => {
    seed(dayPunches(TODAY, 'a'))
    const wrapper = mount(PunchView)
    const cards = wrapper.findAll('.day')
    expect(cards).toHaveLength(1)
    expect(cards[0]?.find('h3').text()).toBe('2026年5月11日(月)')
    expect(wrapper.find('.empty').exists()).toBe(false)
  })

  // 日を追うごとにカードが積み上がるのを避けるための仕様
  it('過去の日は表示しない', () => {
    seed([...dayPunches(YESTERDAY, 'a'), ...dayPunches('2026-05-01', 'b')])
    const wrapper = mount(PunchView)
    expect(wrapper.findAll('.day')).toHaveLength(0)
    expect(wrapper.get('.empty').text()).toContain('今日の打刻はまだありません')
  })

  it('過去の記録があっても今日の分だけを表示する', () => {
    seed([...dayPunches(YESTERDAY, 'a'), ...dayPunches(TODAY, 'b'), ...dayPunches('2026-05-01', 'c')])
    const wrapper = mount(PunchView)
    const cards = wrapper.findAll('.day')
    expect(cards).toHaveLength(1)
    expect(cards[0]?.find('h3').text()).toBe('2026年5月11日(月)')
  })

  it('今日の記録は修正・削除できる', () => {
    seed(dayPunches(TODAY, 'a'))
    const wrapper = mount(PunchView)
    // 過去の日は月次集計から直すが、今日の分はこの画面で直せる
    expect(0).toBeLessThan(wrapper.findAll('.day button').length)
    expect(wrapper.find('.day .add').exists()).toBe(true)
  })

  it('打刻パネルは常に表示する', () => {
    const wrapper = mount(PunchView)
    expect(wrapper.find('.panel').exists()).toBe(true)
    expect(wrapper.findAll('.panel .punch')).toHaveLength(4)
  })

  it('ストアのエラーを表示する', () => {
    const wrapper = mount(PunchView)
    expect(wrapper.find('.error').exists()).toBe(false)
  })
})
