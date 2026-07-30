import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PunchRow from '@/components/PunchRow.vue'
import type { Punch } from '@/types/attendance'

/**
 * 打刻 1 件の表示のテスト。
 *
 * このコンポーネントは props を受け取り、操作の意図を emit するだけである
 * （props down, events up）。状態を持たないため、ストアを用意せずに検証できる。
 */

const punch: Punch = { id: 'p1', type: 'break-start', at: '2026-05-11T12:00' }

describe('PunchRow', () => {
  it('時刻と種別を表示する', () => {
    const wrapper = mount(PunchRow, { props: { punch } })
    expect(wrapper.find('.time').text()).toBe('12:00')
    expect(wrapper.find('.label').text()).toBe('休憩開始')
  })

  it('種別を class に反映する', () => {
    const wrapper = mount(PunchRow, { props: { punch } })
    expect(wrapper.find('.label').classes()).toContain('break-start')
  })

  it('修正で id を伴う edit を emit する', async () => {
    const wrapper = mount(PunchRow, { props: { punch } })
    await wrapper.get('button[aria-label="休憩開始"], button').trigger('click')
    expect(wrapper.emitted('edit')).toEqual([['p1']])
  })

  it('削除で id を伴う remove を emit する', async () => {
    const wrapper = mount(PunchRow, { props: { punch } })
    await wrapper.get('.remove').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['p1']])
  })

  // 自身では状態を変えない。削除するかどうかを決めるのは親の役割である
  it('自分では何も削除しない', async () => {
    const wrapper = mount(PunchRow, { props: { punch } })
    await wrapper.get('.remove').trigger('click')
    expect(wrapper.find('.time').text()).toBe('12:00')
  })

  it('渡された打刻に応じて表示が変わる', () => {
    const wrapper = mount(PunchRow, {
      props: { punch: { id: 'p2', type: 'clock-out', at: '2026-05-11T18:30' } },
    })
    expect(wrapper.find('.time').text()).toBe('18:30')
    expect(wrapper.find('.label').text()).toBe('退勤')
  })
})
