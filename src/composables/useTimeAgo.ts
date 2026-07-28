import { computed, ref, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'

import { useAutoRefresh } from '@/composables/useAutoRefresh'

/** 「〇分前」の表示を計算し直す間隔。 */
const TICK_MS = 30_000

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/**
 * 2 つの時刻の差を、概略的な「〇〇前」という表現に整形する。
 *
 * 内部で `Date.now()` を呼び出さない純粋関数であり、始点と終点はいずれも
 * 呼び出し側が渡す。そのためテストが容易である。以下のリアクティブな処理の
 * 可読性を保つため、インラインにせずモジュールレベルの関数として切り出している。
 *
 * @param fromMs - 過去側の時刻（エポックミリ秒）。予報を取得した時刻など
 * @param toMs - 基準となる現在時刻（エポックミリ秒）
 * @returns 「たった今」「5分前」「2時間前」のような表示用の文字列
 */
export function formatTimeAgo(fromMs: number, toMs: number): string {
  const elapsed = Math.max(0, toMs - fromMs)

  if (elapsed < MINUTE_MS) {
    return 'たった今'
  }
  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS)
    return `${minutes}分前`
  }
  // 日本語には単数と複数の区別が無いため、英語版にあった「1 hour / N hours」の
  // 出し分けは不要である。
  const hours = Math.floor(elapsed / HOUR_MS)
  return `${hours}時間前`
}

/**
 * 過去の時刻を「〇〇前」と表示する、自動的に更新されるラベル。
 *
 * コンポーザブルは組み合わせて使用できる。この関数は {@link useAutoRefresh} を
 * 用いて内部の `now` を定期的に更新している。そのため、コンポーネント側で
 * タイマーを実装しなくても、表示は「2分前」から「3分前」へ自動的に変化する。
 * 小さな関数の上にさらに小さな関数を重ねるこの構成が合成のパターンであり、
 * Java においてサービスが別のサービスに依存するのと同じ考え方による。
 *
 * @param timestamp - 過去の時刻（エポックミリ秒）。ref またはゲッターを渡せば
 *   リアクティブなまま保たれるため、予報の再取得時も表示が追随する。
 *   `undefined` の場合は空文字を返す（未取得の状態）
 * @returns ラベル文字列の computed
 */
export function useTimeAgo(timestamp: MaybeRefOrGetter<number | undefined>): ComputedRef<string> {
  const now = ref(Date.now())

  // 呼び出し側ごとにタイマーが 1 つ生成される。カードが数枚であれば問題ないが、
  // 規模が拡大する場合は、モジュールレベルで 1 つのタイマーを共有する形に
  // まとめることが次の改善案となる。
  useAutoRefresh(() => {
    now.value = Date.now()
  }, TICK_MS)

  return computed(() => {
    const from = toValue(timestamp)
    return from === undefined ? '' : formatTimeAgo(from, now.value)
  })
}
