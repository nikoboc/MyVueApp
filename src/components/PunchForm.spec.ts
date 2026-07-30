import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import PunchForm from '@/components/PunchForm.vue'
import type { Punch } from '@/types/attendance'

/**
 * 打刻 1 件の入力フォームのテスト。
 *
 * 日付は props で与えられ、フォームは時刻だけを扱う。emit するのは日付と時刻を
 * 組み合わせた完全な値であり、その組み立てが正しいことがここでの要点になる。
 */

const DATE = '2026-05-11'

describe('PunchForm', () => {
  // 属性セレクターからは要素の型が推論されないため、型引数で明示する
  it('追加のときは空の状態で始まる', () => {
    const wrapper = mount(PunchForm, { props: { punch: null, date: DATE } })
    expect(wrapper.get<HTMLInputElement>('input[type=time]').element.value).toBe('')
    expect(wrapper.get('select').element.value).toBe('clock-in')
  })

  it('修正のときは既存の値が入る', () => {
    const punch: Punch = { id: 'p1', type: 'break-end', at: `${DATE}T12:45` }
    const wrapper = mount(PunchForm, { props: { punch, date: DATE } })
    expect(wrapper.get<HTMLInputElement>('input[type=time]').element.value).toBe('12:45')
    expect(wrapper.get('select').element.value).toBe('break-end')
  })

  it('日付欄は持たない', () => {
    const wrapper = mount(PunchForm, { props: { punch: null, date: DATE } })
    expect(wrapper.find('input[type=date]').exists()).toBe(false)
  })

  it('props の日付と入力した時刻を組み合わせて emit する', async () => {
    const wrapper = mount(PunchForm, { props: { punch: null, date: DATE } })
    await wrapper.get('select').setValue('break-start')
    await wrapper.get('input[type=time]').setValue('12:00')
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toEqual([['break-start', `${DATE}T12:00`]])
  })

  it('取消で cancel を emit する', async () => {
    const wrapper = mount(PunchForm, { props: { punch: null, date: DATE } })
    await wrapper.get('.cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('種別を変えずに時刻だけ直せる', async () => {
    const punch: Punch = { id: 'p1', type: 'clock-out', at: `${DATE}T18:00` }
    const wrapper = mount(PunchForm, { props: { punch, date: DATE } })
    await wrapper.get('input[type=time]').setValue('19:30')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toEqual([['clock-out', `${DATE}T19:30`]])
  })
})
