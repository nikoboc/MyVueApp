<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseDialog from '@/components/BaseDialog.vue'
import { buildDayPunches } from '@/services/attendance'
import { describeDayEntryIssue } from '@/services/punchLabels'
import { formatDateLabel } from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'
import type { DayEntryIssue, PunchDraft } from '@/types/attendance'

/**
 * 1 日分の勤務をまとめて入力するダイアログ。
 *
 * 打刻を 1 件ずつ足していく方法では、出勤・休憩・退勤の 4 件を入力し終えるまで
 * 「退勤の打刻がありません」と警告が出続け、順序の矛盾にも最後まで気づけない。
 * まとめて受け取ることで、保存する前に検証して指摘できる。
 *
 * 入力の検証はサービス層の {@link buildDayPunches} が行い、この画面は結果を
 * 表示するだけである。保存そのものは親に任せる（events up、CLAUDE.md 規約 2）。
 */
const props = defineProps<{
  /** 日付の初期値 "YYYY-MM-DD"。 */
  date: string
}>()

const emit = defineEmits<{
  (e: 'submit', date: string, punches: readonly PunchDraft[]): void
  (e: 'cancel'): void
}>()

const store = useAttendanceStore()

const date = ref(props.date)
const clockIn = ref('')
const clockOut = ref('')
const breakStart = ref('')
const breakEnd = ref('')

// 直前の送信で見つかった指摘。入力し直せるよう、ダイアログは開いたままにする。
const issue = ref<DayEntryIssue | null>(null)

// 置き換えの対象になる既存の打刻。日付を選び直すたびに再評価される。
const existingCount = computed(() => store.summaryFor(date.value).punches.length)

/**
 * 入力を検証し、問題がなければ親へ渡す。
 */
function submit(): void {
  const result = buildDayPunches({
    date: date.value,
    clockIn: clockIn.value,
    clockOut: clockOut.value,
    breakStart: breakStart.value,
    breakEnd: breakEnd.value,
  })

  if (!result.ok) {
    issue.value = result.issue
    return
  }
  issue.value = null
  emit('submit', date.value, result.punches)
}
</script>

<template>
  <BaseDialog :open="true" title="1日分をまとめて入力" @cancel="emit('cancel')">
    <form id="day-entry" class="form" @submit.prevent="submit">
      <label>
        <span>日付</span>
        <input v-model="date" type="date" required />
      </label>
      <label>
        <span>出勤</span>
        <input v-model="clockIn" type="time" required />
      </label>
      <label>
        <span>休憩開始</span>
        <input v-model="breakStart" type="time" />
      </label>
      <label>
        <span>休憩終了</span>
        <input v-model="breakEnd" type="time" />
      </label>
      <label>
        <span>退勤</span>
        <input v-model="clockOut" type="time" required />
      </label>
    </form>

    <p class="hint">休憩がない日は、休憩の 2 つを空欄のままにしてください。</p>

    <!-- 既にその日の記録がある場合、保存すると入れ替わる。取り消せないため、
         保存する前に件数を示す。 -->
    <p v-if="0 < existingCount" class="replace" role="status">
      {{ formatDateLabel(date) }}には既に {{ existingCount }} 件の打刻があります。保存すると入力した内容に置き換わります。
    </p>

    <p v-if="issue !== null" class="issue" role="alert">{{ describeDayEntryIssue(issue) }}</p>

    <template #actions>
      <button type="button" class="cancel" @click="emit('cancel')">取消</button>
      <button type="submit" form="day-entry" class="confirm">保存</button>
    </template>
  </BaseDialog>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
label span {
  flex: 0 0 5rem;
  font-size: 0.9rem;
  color: gray;
}
input {
  flex: 1;
  min-width: 0;
  padding: 0.4rem 0.5rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: transparent;
  color: inherit;
  font-size: 1rem;
}
.hint {
  margin: 0.75rem 0 0;
  font-size: 0.8rem;
  color: gray;
}
.replace {
  margin: 0.6rem 0 0;
  padding: 0.5rem 0.7rem;
  border-radius: 0.4rem;
  background: rgba(255, 165, 0, 0.14);
  color: darkorange;
  font-size: 0.8rem;
  line-height: 1.5;
}
.issue {
  margin: 0.6rem 0 0;
  padding: 0.5rem 0.7rem;
  border-radius: 0.4rem;
  background: rgba(220, 38, 38, 0.1);
  color: crimson;
  font-size: 0.85rem;
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
.confirm {
  border-color: seagreen;
  color: seagreen;
}

@media (pointer: coarse) {
  button,
  input {
    min-height: 44px;
  }
}
</style>
