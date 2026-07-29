<script setup lang="ts">
import { PUNCH_LABELS } from '@/services/punchLabels'
import { toClock } from '@/services/time'
import type { Punch } from '@/types/attendance'

/**
 * 打刻 1 件の表示。
 *
 * 表示だけを担当し、修正も削除も自分では行わない。操作の意図を `edit` と
 * `remove` で親へ伝え、実際の処理は親が決める（events up、CLAUDE.md 規約 2）。
 */
defineProps<{ punch: Punch }>()

const emit = defineEmits<{
  (e: 'edit', id: string): void
  (e: 'remove', id: string): void
}>()
</script>

<template>
  <li class="row">
    <span class="time">{{ toClock(punch.at) }}</span>
    <span class="label" :class="punch.type">{{ PUNCH_LABELS[punch.type] }}</span>
    <!-- 2 つのボタンは 1 つの要素にまとめる。個別に並べると、幅が足りない
         端末で「修正」だけが前の行に残って離れてしまう。 -->
    <span class="actions">
      <button type="button" @click="emit('edit', punch.id)">修正</button>
      <button type="button" class="remove" @click="emit('remove', punch.id)">削除</button>
    </span>
  </li>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0;
  /* 幅が足りない端末では、操作ボタンを次の行へ送る。1 行に詰め込むと
     ラベルが「出/勤」のように途中で改行されてしまう。 */
  flex-wrap: wrap;
}
.time {
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
  min-width: 3.5rem;
}
.label {
  font-size: 0.85rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(128, 128, 128, 0.4);
  color: gray;
  white-space: nowrap;
}
.label.clock-in {
  border-color: seagreen;
  color: seagreen;
}
.label.clock-out {
  border-color: crimson;
  color: crimson;
}
.label.break-start,
.label.break-end {
  border-color: darkorange;
  color: darkorange;
}
.actions {
  display: flex;
  gap: 0.5rem;
  /* 余白を左に寄せて右端へ揃える。折り返したときもまとまって移動する。 */
  margin-left: auto;
}
button {
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.3);
  background: transparent;
  color: gray;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}
button:hover,
button:focus-visible {
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
}
.remove:hover,
.remove:focus-visible {
  background: rgba(220, 38, 38, 0.12);
  color: crimson;
}

/* 指で操作する端末ではタップ領域を広げる。マウスなら 28px でも狙えるが、
   指では 44px 程度が必要になる（WCAG 2.5.5 の基準）。 */
@media (pointer: coarse) {
  button {
    min-height: 44px;
    min-width: 44px;
    padding: 0.4rem 0.9rem;
    font-size: 0.9rem;
  }
}
</style>
