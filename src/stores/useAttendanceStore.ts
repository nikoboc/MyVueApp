import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { summarizeByDate, summarizeDay, summarizeMonth } from '@/services/attendance'
import { createPunchId, loadPunches, savePunches } from '@/services/punchStorage'
import { formatDateTime, parseDateTime } from '@/services/time'
import type { DaySummary, MonthSummary, Punch, PunchType } from '@/types/attendance'

/**
 * 打刻を保持する中心のストア。状態はここに集約され、コンポーネントはここから
 * 参照し、ここのアクションを起動する。保存層を呼び出すのもストアのみである
 * （CLAUDE.md のアーキテクチャ規約）。詳細は docs/03-state-and-data.md を参照。
 *
 * 保持する状態は打刻の列だけである。日ごとの集計は `days` として導出しており、
 * 打刻を 1 件修正すれば集計も表示も自動的に追随する。
 */
export const useAttendanceStore = defineStore('attendance', () => {
  // --- state（状態） ---

  /** すべての打刻。起動時に保存済みのデータを読み込む。 */
  const punches = ref<Punch[]>(loadPunches())

  /** 直近のエラーメッセージ。直前の操作が成功した場合は `null`。 */
  const error = ref<string | null>(null)

  // --- getters（導出値） ---

  /** 日付ごとの集計。新しい日が先頭に並ぶ。 */
  const days = computed<DaySummary[]>(() => summarizeByDate(punches.value))

  // --- 永続化 ---

  // 打刻が変わるたびに保存する。各アクションの末尾で保存を呼ぶ方法もあるが、
  // それでは保存漏れがアクションの追加ごとに起こりうる。`watch` で状態の変化に
  // 反応させておけば、保存の責務がこの 1 か所にまとまる。
  //
  // 配列の中身（既存の打刻の時刻）を書き換えても反応させたいため `deep` を指定
  // している。
  watch(
    punches,
    (value) => {
      try {
        savePunches(value)
        error.value = null
      } catch (e) {
        error.value = e instanceof Error ? e.message : '保存に失敗しました'
      }
    },
    { deep: true },
  )

  // --- actions（アクション） ---

  /**
   * 指定した日付の集計を返す。打刻が 1 件も無い日でも、空の集計を返す。
   *
   * @param date - 日付キー "YYYY-MM-DD"
   * @returns その日の集計
   */
  function summaryFor(date: string): DaySummary {
    return days.value.find((day) => day.date === date) ?? summarizeDay(date, [])
  }

  /**
   * 指定した月の集計を返す。打刻が 1 件も無い月でも、0 が並んだ集計を返す。
   *
   * @param month - 月キー "YYYY-MM"
   * @returns その月の集計
   */
  function monthSummaryFor(month: string): MonthSummary {
    return summarizeMonth(month, days.value)
  }

  /**
   * 現在時刻で打刻する。
   *
   * @param type - 打刻の種別
   * @param atMs - 打刻時刻（エポックミリ秒）。既定は現在時刻
   */
  function punch(type: PunchType, atMs: number = Date.now()): void {
    addPunch(type, formatDateTime(atMs))
  }

  /**
   * 時刻を指定して打刻を追加する。打刻漏れを後から補う場合に用いる。
   *
   * @param type - 打刻の種別
   * @param at - "YYYY-MM-DDTHH:mm" 形式の時刻
   * @returns 追加できた場合は true。時刻が不正な場合は false
   */
  function addPunch(type: PunchType, at: string): boolean {
    if (parseDateTime(at) === undefined) {
      error.value = '時刻の形式が正しくありません'
      return false
    }
    punches.value.push({ id: createPunchId(), type, at })
    return true
  }

  /**
   * 既存の打刻を修正する。
   *
   * @param id - 対象の `Punch.id`
   * @param type - 修正後の種別
   * @param at - 修正後の "YYYY-MM-DDTHH:mm" 形式の時刻
   * @returns 修正できた場合は true。時刻が不正、または対象が無い場合は false
   */
  function updatePunch(id: string, type: PunchType, at: string): boolean {
    if (parseDateTime(at) === undefined) {
      error.value = '時刻の形式が正しくありません'
      return false
    }
    const index = punches.value.findIndex((item) => item.id === id)
    if (index < 0) {
      return false
    }
    // 要素を差し替えることで、配列を参照している導出値へ変更が確実に伝わる。
    punches.value.splice(index, 1, { id, type, at })
    return true
  }

  /**
   * 打刻を削除する。誤って記録した打刻を取り消す場合に用いる。
   *
   * @param id - 対象の `Punch.id`
   */
  function removePunch(id: string): void {
    punches.value = punches.value.filter((item) => item.id !== id)
  }

  return {
    punches,
    error,
    days,
    summaryFor,
    monthSummaryFor,
    punch,
    addPunch,
    updatePunch,
    removePunch,
  }
})
