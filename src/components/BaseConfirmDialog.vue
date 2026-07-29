<script setup lang="ts">
import BaseDialog from '@/components/BaseDialog.vue'

/**
 * 操作の確認を求めるダイアログ。再利用可能な部品であるため `Base` を接頭辞として
 * いる（CLAUDE.md の命名規約）。打刻にも削除にも関心を持たず、渡された文言を
 * 表示して結果を emit するだけである。
 *
 * 開閉の制御は {@link BaseDialog} に任せ、ここは確認という用途に固有の部分だけを
 * 持つ。
 */
withDefaults(
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
</script>

<template>
  <BaseDialog :open="open" :title="title" @cancel="emit('cancel')">
    <p class="message">{{ message }}</p>

    <template #actions>
      <!-- 取り消しを先に置く。開いた直後のフォーカスはダイアログ自身にあるため
           （BaseDialog を参照）、Enter で確定してしまうことはない。 -->
      <button type="button" class="cancel" @click="emit('cancel')">取消</button>
      <button type="button" class="confirm" :class="tone" @click="emit('confirm')">
        {{ confirmLabel }}
      </button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.message {
  margin: 0;
  color: gray;
  line-height: 1.5;
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
