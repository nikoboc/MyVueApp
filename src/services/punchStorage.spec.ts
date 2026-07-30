import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createPunchId, loadPunches, savePunches } from '@/services/punchStorage'
import type { Punch } from '@/types/attendance'

/**
 * 保存層のテスト。
 *
 * ここで確かめたいのは往復だけではない。`localStorage` は利用者が開発者ツールで
 * 書き換えられる外部の境界であり、壊れた値を読んでもアプリが使えなくならないこと、
 * および条件を満たさない打刻を捨てることが要点である（docs/05 §6）。
 */

const KEY = 'timecard.punches.v1'

const validPunch: Punch = { id: 'a1', type: 'clock-in', at: '2026-05-11T09:00' }

beforeEach(() => {
  localStorage.clear()
})

describe('savePunches と loadPunches', () => {
  it('保存した打刻を読み戻せる', () => {
    const punches: Punch[] = [
      validPunch,
      { id: 'a2', type: 'clock-out', at: '2026-05-11T18:00' },
    ]
    savePunches(punches)
    expect(loadPunches()).toEqual(punches)
  })

  it('空の配列も往復できる', () => {
    savePunches([])
    expect(loadPunches()).toEqual([])
  })

  it('未保存なら空配列を返す', () => {
    expect(loadPunches()).toEqual([])
  })
})

describe('loadPunches の検証', () => {
  /** localStorage へ生の文字列を書き込む。 */
  function writeRaw(raw: string): void {
    localStorage.setItem(KEY, raw)
  }

  // 起動時に例外を投げるとアプリが使えなくなるため、空として扱う
  it('JSON として壊れていれば空配列を返す', () => {
    writeRaw('{ こわれた')
    expect(loadPunches()).toEqual([])
  })

  it('配列でなければ空配列を返す', () => {
    writeRaw('{"punches":[]}')
    expect(loadPunches()).toEqual([])
    writeRaw('"文字列"')
    expect(loadPunches()).toEqual([])
    writeRaw('null')
    expect(loadPunches()).toEqual([])
  })

  it('条件を満たさない要素だけを捨てる', () => {
    writeRaw(
      JSON.stringify([
        validPunch,
        { id: 'b1', type: 'lunch', at: '2026-05-11T12:00' }, // 未知の種別
        { id: 'b2', type: 'clock-out', at: '2026-05-11 18:00' }, // 形式違い
        { id: 'b3', type: 'clock-out', at: '2026-02-31T18:00' }, // 実在しない日付
        { id: 'b4', type: 'clock-out' }, // at が無い
        { type: 'clock-out', at: '2026-05-11T18:00' }, // id が無い
        { id: 5, type: 'clock-out', at: '2026-05-11T18:00' }, // id が数値
        null,
        'clock-in',
        42,
      ]),
    )
    expect(loadPunches()).toEqual([validPunch])
  })

  it('すべて不正なら空配列を返す', () => {
    writeRaw(JSON.stringify([null, 42, {}]))
    expect(loadPunches()).toEqual([])
  })
})

describe('savePunches の失敗', () => {
  // 保存の失敗は利用者に伝える必要があるため、読み込みと違って例外を通す。
  //
  // jsdom の localStorage は Proxy 越しに実装されており、インスタンスへ spy を
  // 当てても呼び出しを捕まえられない。Storage のプロトタイプ側を差し替える。
  it('localStorage が失敗したら例外を投げる', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() => savePunches([validPunch])).toThrow('QuotaExceededError')
  })
})

describe('createPunchId', () => {
  it('毎回異なる値を返す', () => {
    const ids = new Set(Array.from({ length: 200 }, () => createPunchId()))
    expect(ids.size).toBe(200)
  })

  it('randomUUID が使えない環境でも生成できる', () => {
    // セキュアコンテキスト以外を想定する
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => {
      throw new Error('利用できない')
    })
    // 実装は typeof で存在を確認するため、関数自体を差し替える
    const original = crypto.randomUUID
    Reflect.deleteProperty(crypto, 'randomUUID')
    try {
      const id = createPunchId()
      expect(typeof id).toBe('string')
      expect(0).toBeLessThan(id.length)
    } finally {
      Object.defineProperty(crypto, 'randomUUID', { value: original, configurable: true })
    }
  })
})
