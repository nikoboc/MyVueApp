import { computed, ref, type ComputedRef } from 'vue'

import { useAutoRefresh } from '@/composables/useAutoRefresh'

/** 現在時刻の既定の更新間隔。 */
const DEFAULT_INTERVAL_MS = 1000

/**
 * 一定間隔で更新される現在時刻。
 *
 * コンポーザブルは組み合わせて使用できる。この関数は {@link useAutoRefresh} を
 * 用いて内部の ref を更新しているだけであり、タイマーの破棄もそちらに任せている。
 *
 * 集計処理が現在時刻を参照しないため、経過時間の実時間表示はこの関数を使う
 * コンポーネント側の責務となる。集計を純粋に保つ代わりに、時間の経過という
 * 副作用をここへ閉じ込めている。
 *
 * @param intervalMs - 更新間隔（ミリ秒）
 * @returns 現在時刻（エポックミリ秒）の computed
 */
export function useNow(intervalMs: number = DEFAULT_INTERVAL_MS): ComputedRef<number> {
  const now = ref(Date.now())

  useAutoRefresh(() => {
    now.value = Date.now()
  }, intervalMs)

  // 書き換えを防ぐため computed として返す。呼び出し側は読み取るだけでよい。
  return computed(() => now.value)
}
