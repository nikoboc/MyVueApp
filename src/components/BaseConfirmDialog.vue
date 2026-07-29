<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

/**
 * 操作の確認を求めるダイアログ。再利用可能な部品であるため `Base` を接頭辞として
 * いる（CLAUDE.md の命名規約）。打刻にも削除にも関心を持たず、渡された文言を
 * 表示して結果を emit するだけである。
 *
 * `window.confirm` ではなく HTML の `<dialog>` を用いる。`showModal()` を呼ぶと
 * 背景の操作を遮断し、Esc での取り消しとフォーカスの閉じ込めが標準で働くため、
 * これらを自前で実装する必要がない。ホーム画面から起動したときに配信元の URL が
 * 表示されてしまう問題も避けられる。
 */
const props = withDefaults(
  defineProps<{
    /** ダイアログを表示するかどうか。開閉は親が状態として持つ。 */
    open: boolean
    title: string
    message: string
    confirmLabel?: string
    /** `danger` を指定すると、確定ボタンを取り消せない操作の見た目にする。 */
    tone?: 'normal' | 'danger'
  }>(),
  { confirmLabel: '実行', tone: 'normal' },
)

const emit = defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const dialog = ref<HTMLDialogElement | null>(null)

// `open` の変化に合わせて実際の開閉を行う。開閉状態は親が持ち、こちらは DOM へ
// 反映するだけなので、表示の指示が 1 か所に集まる。
//
// すでに開いている `<dialog>` に `showModal()` を呼ぶと例外になるため、現在の
// 状態を確認してから呼ぶ。
watch(
  () => props.open,
  (open) => {
    const element = dialog.value
    if (element === null) {
      return
    }
    if (open && !element.open) {
      element.showModal()
    } else if (!open && element.open) {
      element.close()
    }
  },
)

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
    <p class="message">{{ message }}</p>
    <div class="actions">
      <!-- 取り消しを先に置く。`showModal()` は最初の操作可能な要素に
           フォーカスするため、誤って確定してしまう事故を減らせる。 -->
      <button type="button" class="cancel" @click="emit('cancel')">取消</button>
      <button type="button" class="confirm" :class="tone" @click="emit('confirm')">
        {{ confirmLabel }}
      </button>
    </div>
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
.message {
  margin: 0.6rem 0 1.1rem;
  color: gray;
  line-height: 1.5;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}
button {
  padding: 0.5rem 1.1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1rem;
}
button:hover,
button:focus-visible {
  background: rgba(128, 128, 128, 0.15);
}
.confirm.normal {
  border-color: seagreen;
  color: seagreen;
}
.confirm.danger {
  border-color: crimson;
  color: crimson;
}
.confirm.danger:hover,
.confirm.danger:focus-visible {
  background: rgba(220, 38, 38, 0.12);
}

/* 指で操作する端末ではタップ領域を広げる（PunchRow と同じ理由）。 */
@media (pointer: coarse) {
  button {
    min-height: 44px;
    min-width: 5.5rem;
  }
}
</style>
