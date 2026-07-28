import { onMounted, onUnmounted } from 'vue'

/**
 * 呼び出し元のコンポーネントがマウントされている間だけ、一定間隔で `onTick` を
 * 実行する。アンマウント時にはタイマーを自動的に破棄する。
 *
 * 本フェーズの中心的な題材である。コンポーネント内で `setInterval` を開始した
 * まま `clearInterval` を行わないと、メモリリークが発生する。コンポーネントの
 * 破棄後もコールバックが実行され続けてクロージャを保持し、再マウントのたびに
 * タイマーが増加する。これを防ぐのが `onMounted`（開始）と `onUnmounted`
 * （破棄）を対にする実装であり、Java において開いたリソースを必ず閉じるのと
 * 同じ考え方による。この関数にまとめることで、呼び出し側はクリーンアップを
 * 意識せずに済む。
 *
 * @param onTick - 一定間隔で実行する処理（データの再取得など）
 * @param intervalMs - 実行間隔（ミリ秒）
 */
export function useAutoRefresh(onTick: () => void, intervalMs: number): void {
  // 型に `number` ではなく `ReturnType<typeof setInterval>` を用いる理由は
  // 次のとおり。ブラウザでは id が number となるが、本プロジェクトには
  // @types/node が含まれており `NodeJS.Timeout` として型付けされる。関数から
  // 型を導出することで、どちらの環境でも正しい型となる。
  let timerId: ReturnType<typeof setInterval> | undefined

  onMounted(() => {
    timerId = setInterval(onTick, intervalMs)
  })

  onUnmounted(() => {
    if (timerId !== undefined) {
      clearInterval(timerId)
    }
  })
}
