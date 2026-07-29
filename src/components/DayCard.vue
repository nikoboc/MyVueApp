<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseConfirmDialog from '@/components/BaseConfirmDialog.vue'
import PunchForm from '@/components/PunchForm.vue'
import PunchRow from '@/components/PunchRow.vue'
import { describeIssue, PUNCH_LABELS } from '@/services/punchLabels'
import { formatDateLabel, formatDuration, toClock } from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'
import type { DaySummary, PunchType } from '@/types/attendance'

/** 追加フォームを表す識別子。編集対象の `Punch.id` と衝突しない値を用いる。 */
const ADDING = 'adding'

/**
 * 1 日分の記録。集計の表示と、その日の打刻の修正・追加・削除を担当する。
 *
 * 集計は props で受け取るが、状態の変更はストアのアクションを直接呼ぶ
 * （CLAUDE.md 規約 1）。1 日の記録を管理するのはこのコンポーネントであり、
 * 打刻ごとの操作をすべて App まで持ち上げると、中継するだけの emit が
 * 増えて流れが追いにくくなるためである。子の PunchRow は末端の表示に徹し、
 * 操作の意図をここへ emit する（規約 2）。
 */
const props = defineProps<{ summary: DaySummary }>()

const store = useAttendanceStore()

// 編集中の打刻の id、追加中なら ADDING、いずれでもなければ null。この
// コンポーネントの中だけで完結する一時的な UI 状態なので、Pinia には置かない。
const editingId = ref<string | null>(null)

const isAdding = computed(() => editingId.value === ADDING)

const editingPunch = computed(
  () => props.summary.punches.find((punch) => punch.id === editingId.value) ?? null,
)

/**
 * 入力された内容を保存する。追加と修正のどちらであるかは編集中の状態で決まる。
 *
 * @param type - 打刻の種別
 * @param at - "YYYY-MM-DDTHH:mm" 形式の時刻
 */
function save(type: PunchType, at: string): void {
  const saved = isAdding.value
    ? store.addPunch(type, at)
    : store.updatePunch(editingId.value ?? '', type, at)

  // 保存に失敗したときはフォームを開いたままにして、入力をやり直せるようにする。
  if (saved) {
    editingId.value = null
  }
}

// 削除の確認待ちの打刻。`null` のときはダイアログを開かない。
const pendingRemovalId = ref<string | null>(null)

const pendingRemoval = computed(
  () => props.summary.punches.find((punch) => punch.id === pendingRemovalId.value) ?? null,
)

const removalMessage = computed(() => {
  const punch = pendingRemoval.value
  if (punch === null) {
    return ''
  }
  return `${toClock(punch.at)} の「${PUNCH_LABELS[punch.type]}」を削除します。この操作は取り消せません。`
})

/** 確認された打刻を削除する。 */
function confirmRemoval(): void {
  const id = pendingRemovalId.value
  if (id !== null) {
    store.removePunch(id)
    if (editingId.value === id) {
      editingId.value = null
    }
  }
  pendingRemovalId.value = null
}
</script>

<template>
  <article class="day">
    <header>
      <h3>{{ formatDateLabel(summary.date) }}</h3>
      <dl class="totals">
        <div>
          <dt>実働</dt>
          <dd>{{ formatDuration(summary.workedMs) }}</dd>
        </div>
        <div>
          <dt>休憩</dt>
          <dd>{{ formatDuration(summary.breakMs) }}</dd>
        </div>
      </dl>
    </header>

    <!-- 打刻漏れは後から気づきにくいため、集計で検出した不整合をその日の欄に
         そのまま表示する。 -->
    <ul v-if="0 < summary.issues.length" class="issues">
      <li v-for="issue in summary.issues" :key="issue.kind">{{ describeIssue(issue) }}</li>
    </ul>

    <ul class="punches">
      <template v-for="punch in summary.punches" :key="punch.id">
        <!-- 編集中の行はフォームに差し替える。:key に id を指定しているため、
             対象が変わればフォームは初期値ごと作り直される。 -->
        <li v-if="editingId === punch.id" class="editing">
          <PunchForm
            :key="punch.id"
            :punch="punch"
            :date="summary.date"
            :editable-date="false"
            @submit="save"
            @cancel="editingId = null"
          />
        </li>
        <PunchRow
          v-else
          :punch="punch"
          @edit="editingId = $event"
          @remove="pendingRemovalId = $event"
        />
      </template>
    </ul>

    <PunchForm
      v-if="isAdding"
      :punch="editingPunch"
      :date="summary.date"
      :editable-date="false"
      @submit="save"
      @cancel="editingId = null"
    />
    <button v-else type="button" class="add" @click="editingId = ADDING">打刻を追加</button>

    <!-- 削除は取り消せず、消した打刻は集計からも消える。誤ってタップした場合の
         被害が大きいため確認する。 -->
    <BaseConfirmDialog
      :open="pendingRemoval !== null"
      title="打刻の削除"
      :message="removalMessage"
      confirm-label="削除"
      tone="danger"
      @confirm="confirmRemoval"
      @cancel="pendingRemovalId = null"
    />
  </article>
</template>

<style scoped>
.day {
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
h3 {
  margin: 0;
  font-size: 1.05rem;
}
.totals {
  display: flex;
  gap: 1.5rem;
  margin: 0;
}
.totals dt {
  font-size: 0.75rem;
  color: gray;
}
.totals dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
.issues {
  list-style: none;
  margin: 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  background: rgba(220, 38, 38, 0.1);
  color: crimson;
  font-size: 0.85rem;
}
.punches {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}
.punches > li {
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
.add {
  align-self: flex-start;
  padding: 0.35rem 0.75rem;
  border-radius: 0.4rem;
  border: 1px dashed rgba(128, 128, 128, 0.5);
  background: transparent;
  color: gray;
  cursor: pointer;
  font-size: 0.85rem;
  white-space: nowrap;
}
.add:hover,
.add:focus-visible {
  background: rgba(128, 128, 128, 0.12);
  color: inherit;
}

/* 指で操作する端末ではタップ領域を広げる（PunchRow と同じ理由）。 */
@media (pointer: coarse) {
  .add {
    min-height: 44px;
    padding: 0.5rem 1rem;
    font-size: 0.95rem;
  }
}
</style>
