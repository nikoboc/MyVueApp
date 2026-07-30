/*
 * テストの前処理。
 *
 * jsdom は `<dialog>` の `showModal()` と `close()` を実装していない。本アプリの
 * ダイアログはこれらを呼ぶため、補わないとダイアログを含むコンポーネントの
 * テストが例外で落ちる。
 *
 * 最前面への表示や背景の操作の遮断までは再現しない。テストで確かめたいのは
 * 「開いているか」と中身の描画であり、その判定には `open` 属性で足りる。
 */

/**
 * `HTMLDialogElement` に不足しているメソッドを補う。
 *
 * 型定義では `showModal` は必ず存在することになっているため、素の比較では
 * 「常に false」と判定されてしまう。実行時の有無を確かめる必要があるので、
 * ここだけプロトタイプを添字アクセスできる形へアサートする（docs/05 §6）。
 */
function polyfillDialog(): void {
  const prototype = HTMLDialogElement.prototype as unknown as Record<string, unknown>

  if (typeof prototype.showModal !== 'function') {
    prototype.showModal = function showModal(this: HTMLDialogElement): void {
      this.open = true
    }
  }
  if (typeof prototype.close !== 'function') {
    prototype.close = function close(this: HTMLDialogElement): void {
      this.open = false
    }
  }
}

polyfillDialog()
