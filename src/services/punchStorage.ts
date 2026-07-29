import { isDateTimeString } from '@/services/time'
import { PUNCH_TYPES, type Punch, type PunchType } from '@/types/attendance'

/**
 * 打刻の保存と読み込み。保存先は `localStorage` であり、サーバーもデータベースも
 * 使わない（CLAUDE.md の対象範囲）。Vue を含まない純粋な TypeScript である。
 *
 * `localStorage` は API と同じく外部の境界であり、返ってくる値に型の保証はない。
 * 利用者が開発者ツールから書き換えることもでき、アプリの旧版が別の形式で書いた
 * データが残っている可能性もある。そのため読み込み時に 1 件ずつ検証し、条件を
 * 満たさないものは捨てる（docs/05 §6）。
 */

const STORAGE_KEY = 'timecard.punches.v1'

/**
 * 値が打刻の種別かどうかを判定する。
 *
 * @param value - 判定する文字列
 * @returns `PunchType` であれば true
 */
function isPunchType(value: string): value is PunchType {
  return (PUNCH_TYPES as readonly string[]).includes(value)
}

/**
 * 外部から読み込んだ値が打刻として妥当かどうかを判定する。
 *
 * @param value - 型の分からない値
 * @returns `Punch` として扱えれば true
 */
function isPunch(value: unknown): value is Punch {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  // 個々のプロパティを検証する前段としての絞り込みであり、この後すべての
  // フィールドを個別に確認している（docs/05 §6）。
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.type === 'string' &&
    isPunchType(record.type) &&
    typeof record.at === 'string' &&
    isDateTimeString(record.at)
  )
}

/**
 * 保存済みの打刻をすべて読み込む。
 *
 * 読み込みは起動時の 1 回だけであり、ここで失敗してもアプリが使えなくなっては
 * 困る。そのため壊れたデータは例外にせず、空の状態として扱う。
 *
 * @returns 保存されていた打刻。未保存または解析に失敗した場合は空配列
 */
export function loadPunches(): Punch[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw === null) {
    return []
  }

  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isPunch) : []
  } catch {
    return []
  }
}

/**
 * 打刻をすべて保存する。
 *
 * @param punches - 保存する打刻
 * @throws 保存領域の上限を超えた場合など、`localStorage` が失敗した場合
 */
export function savePunches(punches: readonly Punch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(punches))
}

/**
 * 打刻の識別子を生成する。
 *
 * `crypto.randomUUID` はセキュアコンテキスト（https と localhost）でのみ使える。
 * LAN の IP へ http で接続した場合などに備え、代替の生成方法を用意している。
 *
 * @returns 一意な識別子
 */
export function createPunchId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
