import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import DayEntryDialog from '@/components/DayEntryDialog.vue'
import type { DayEntry } from '@/types/attendance'

/**
 * 1 日分をまとめて入力するダイアログのテスト。
 *
 * 検証そのものはサービス層で確認済みなので、ここで確かめるのは画面側の責務である。
 * すなわち、指摘を表示してダイアログを閉じないこと、休憩の行を増減できること、
 * 保存時に組み立てた打刻を親へ渡すことである。
 *
 * jsdom は `<dialog>` の showModal を持たないため、vitest.setup.ts で補っている。
 */

const DATE = '2026-05-11'

/** 空の入力値。 */
function emptyEntry(over: Partial<DayEntry> = {}): DayEntry {
  return { date: DATE, clockIn: '', clockOut: '', breaks: [], ...over }
}

/** ダイアログをマウントする。 */
function mountDialog(entry: DayEntry, lockDate = false) {
  return mount(DayEntryDialog, { props: { entry, lockDate }, attachTo: document.body })
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('DayEntryDialog', () => {
  it('開いた状態で描画される', () => {
    const wrapper = mountDialog(emptyEntry())
    expect(wrapper.find('dialog').attributes('open')).not.toBeUndefined()
  })

  it('記録が無い日は「入力」と表示する', () => {
    const wrapper = mountDialog(emptyEntry())
    expect(wrapper.find('h2').text()).toBe('1日分をまとめて入力')
    expect(wrapper.find('.replace').exists()).toBe(false)
  })

  it('休憩の行は最初から 1 行ある', () => {
    const wrapper = mountDialog(emptyEntry())
    expect(wrapper.findAll('.break-row')).toHaveLength(1)
  })

  it('既存の休憩をすべて表示する', () => {
    const wrapper = mountDialog(
      emptyEntry({
        clockIn: '09:00',
        clockOut: '18:00',
        breaks: [
          { start: '12:00', end: '12:45' },
          { start: '15:00', end: '15:15' },
        ],
      }),
    )
    const rows = wrapper.findAll('.break-row')
    expect(rows).toHaveLength(2)
    expect(rows[1]?.findAll('input')[0]?.element.value).toBe('15:00')
  })

  it('休憩の行を増やせる', async () => {
    const wrapper = mountDialog(emptyEntry())
    await wrapper.get('.add-break').trigger('click')
    expect(wrapper.findAll('.break-row')).toHaveLength(2)
  })

  // 添字を :key にすると、途中を削除したとき値が隣の行へずれてしまう
  it('途中の行を削除しても他の行の値が残る', async () => {
    const wrapper = mountDialog(
      emptyEntry({
        breaks: [
          { start: '10:00', end: '10:10' },
          { start: '12:00', end: '12:45' },
          { start: '15:00', end: '15:15' },
        ],
      }),
    )
    const removeButtons = wrapper.findAll('.remove-break')
    await removeButtons[1]?.trigger('click')

    const rows = wrapper.findAll('.break-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.findAll('input')[0]?.element.value).toBe('10:00')
    expect(rows[1]?.findAll('input')[0]?.element.value).toBe('15:00')
  })

  it('最後の行を削除しても空の 1 行が残る', async () => {
    const wrapper = mountDialog(emptyEntry({ breaks: [{ start: '12:00', end: '12:45' }] }))
    await wrapper.get('.remove-break').trigger('click')
    const rows = wrapper.findAll('.break-row')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.findAll('input')[0]?.element.value).toBe('')
  })

  it('入力内容から打刻を組み立てて emit する', async () => {
    const wrapper = mountDialog(
      emptyEntry({ clockIn: '09:00', clockOut: '18:00', breaks: [{ start: '12:00', end: '12:45' }] }),
    )
    await wrapper.get('form').trigger('submit')

    const submitted = wrapper.emitted('submit')
    expect(submitted).toHaveLength(1)
    expect(submitted?.[0]?.[0]).toBe(DATE)
    const punches = submitted?.[0]?.[1] as { type: string; at: string }[]
    expect(punches.map((draft) => draft.type)).toEqual([
      'clock-in',
      'break-start',
      'break-end',
      'clock-out',
    ])
  })

  it('指摘があるときは表示してダイアログを閉じない', async () => {
    const wrapper = mountDialog(
      emptyEntry({
        clockIn: '09:00',
        clockOut: '18:00',
        breaks: [
          { start: '12:00', end: '13:00' },
          { start: '12:30', end: '13:30' },
        ],
      }),
    )
    await wrapper.get('form').trigger('submit')

    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.get('.issue').text()).toBe('休憩の時間が重なっています')
    expect(wrapper.find('dialog').attributes('open')).not.toBeUndefined()
  })

  it('指摘を直せば保存できる', async () => {
    const wrapper = mountDialog(
      emptyEntry({ clockIn: '18:00', clockOut: '09:00' }),
    )
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('.issue').text()).toBe('退勤は出勤より後の時刻にしてください')

    const times = wrapper.findAll('label input[type=time]')
    await times[0]?.setValue('09:00')
    await times[1]?.setValue('18:00')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('submit')).toHaveLength(1)
  })

  it('取消で cancel を emit する', async () => {
    const wrapper = mountDialog(emptyEntry())
    await wrapper.get('.cancel').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })

  describe('既存の記録がある日', () => {
    beforeEach(() => {
      localStorage.setItem(
        'timecard.punches.v1',
        JSON.stringify([
          { id: 'a1', type: 'clock-in', at: `${DATE}T09:00` },
          { id: 'a2', type: 'clock-out', at: `${DATE}T18:00` },
        ]),
      )
      setActivePinia(createPinia())
    })

    it('「修正」と表示し、置き換えを予告する', () => {
      const wrapper = mountDialog(emptyEntry({ clockIn: '09:00', clockOut: '18:00' }), true)
      expect(wrapper.find('h2').text()).toBe('1日分をまとめて修正')
      expect(wrapper.get('.replace').text()).toContain('2 件')
    })

    it('日付を固定すると入力できない', () => {
      const wrapper = mountDialog(emptyEntry(), true)
      expect(wrapper.get('input[type=date]').attributes('disabled')).not.toBeUndefined()
    })

    it('日付を固定しなければ入力できる', () => {
      const wrapper = mountDialog(emptyEntry(), false)
      expect(wrapper.get('input[type=date]').attributes('disabled')).toBeUndefined()
    })
  })

  describe('表しきれない日', () => {
    beforeEach(() => {
      // 中抜け（出退勤が 2 回）
      localStorage.setItem(
        'timecard.punches.v1',
        JSON.stringify([
          { id: 'a1', type: 'clock-in', at: `${DATE}T09:00` },
          { id: 'a2', type: 'clock-out', at: `${DATE}T12:00` },
          { id: 'a3', type: 'clock-in', at: `${DATE}T13:00` },
          { id: 'a4', type: 'clock-out', at: `${DATE}T18:00` },
        ]),
      )
      setActivePinia(createPinia())
    })

    it('一部しか表せないことを伝える', () => {
      const wrapper = mountDialog(emptyEntry({ clockIn: '09:00', clockOut: '18:00' }), true)
      expect(wrapper.get('.lossy').text()).toContain('一部しか表せません')
    })
  })
})
