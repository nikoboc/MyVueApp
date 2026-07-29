<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * ダイアログの土台。開閉の制御だけを担い、中身は呼び出し側がスロットで渡す。
 *
 * `window.confirm` ではなく HTML の `<dialog>` を用いる。`showModal()` を呼ぶと
 * 背景の操作を遮断し、Esc での取り消しとフォーカスの閉じ込めが標準で働くため、
 * これらを自前で実装する必要がない。ホーム画面から起動したときに配信元の URL が
 * 表示されてしまう問題も避けられる。
 *
 * 確認用と入力用でこの開閉処理を二重に持たないよう、共通部分をここへ切り出して
 * いる。中身の差し替えにはスロットを使う。
 */
const props = defineProps<{
  /** ダイアログを表示するかどうか。開閉は親が状態として持つ。 */
  open: boolean
  title: string
}>()

const emit = defineEmits<{ (e: 'cancel'): void }>()

const dialog = ref<HTMLDialogElement | null>(null)

/**
 * `open` の値に合わせて実際の開閉を行う。
 *
 * すでに開いている `<dialog>` に `showModal()` を呼ぶと例外になるため、現在の
 * 状態を確認してから呼ぶ。
 */
function sync(): void {
  const element = dialog.value
  if (element === null) {
    return
  }
  if (props.open && !element.open) {
    element.showModal()
  } else if (!props.open && element.open) {
    element.close()
  }
}

// 親が v-if で開くたびに作り直す場合、`open` は最初から true であり変化しない。
// マウント時にも同期しておかないと、その場合にダイアログが開かない。
onMounted(sync)
watch(() => props.open, sync)

// 開いたままコンポーネントが破棄されると、最前面の表示が残ることがある。
onBeforeUnmount(() => {
  if (dialog.value?.open === true) {
    dialog.value.close()
  }
})
</script>

<template>
  <!-- Esc キーによる取り消しは `cancel` イベントとして届く。閉じる処理は
       ブラウザーが行うため、ここでは親へ結果を伝えるだけでよい。 -->
  <dialog ref="dialog" class="dialog" @cancel="emit('cancel')">
    <h2>{{ title }}</h2>
    <div class="body"><slot /></div>
    <div class="actions"><slot name="actions" /></div>
  </dialog>
</template>

<style scoped>
.dialog {
  border: 1px solid rgba(128, 128, 128, 0.35);
  border-radius: 0.75rem;
  padding: 1.25rem;
  min-width: min(22rem, calc(100vw - 3rem));
  max-width: calc(100vw - 3rem);
  color: inherit;
  background: Canvas;
}
.dialog::backdrop {
  background: rgba(0, 0, 0, 0.45);
}
h2 {
  margin: 0;
  font-size: 1.05rem;
}
.body {
  margin: 0.6rem 0 1.1rem;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
</style>
