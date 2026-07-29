<script setup lang="ts">
import { computed, ref } from 'vue'

import BaseDialog from '@/components/BaseDialog.vue'
import { buildDayPunches, toDayEntry } from '@/services/attendance'
import { describeDayEntryIssue } from '@/services/punchLabels'
import { formatDateLabel } from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'
import type { DayEntry, DayEntryIssue, PunchDraft } from '@/types/attendance'

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
  /**
   * 入力欄の初期値。新規なら時刻を空にした値、修正ならその日の打刻から変換した
   * 値を渡す。呼び出し側が `v-if` で開くたびに作り直すため、ここで一度読むだけで
   * よい。
   */
  entry: DayEntry
  /**
   * 日付の変更を禁じるかどうか。
   *
   * 一覧の「修正」から開いた場合は対象の日が決まっている。ここで日付を変えられる
   * と、その日を直すつもりが別の日の記録を置き換えてしまう。追加のときだけ選ばせる。
   */
  lockDate: boolean
}>()

const emit = defineEmits<{
  (e: 'submit', date: string, punches: readonly PunchDraft[]): void
  (e: 'cancel'): void
}>()

const store = useAttendanceStore()

/** 休憩 1 行分。`id` は `v-for` の `:key` に使う。 */
interface BreakRow {
  id: number
  start: string
  end: string
}

// 行の識別子を採番する。添字を `:key` にすると、途中の行を削除したときに Vue が
// 別の行と取り違え、入力中の値が隣の行へ残ってしまう。
let nextBreakId = 0

/**
 * 休憩の入力行を作る。
 *
 * @param start - 開始時刻 "HH:mm"
 * @param end - 終了時刻 "HH:mm"
 * @returns 採番済みの入力行
 */
function createBreakRow(start = '', end = ''): BreakRow {
  nextBreakId += 1
  return { id: nextBreakId, start, end }
}

const date = ref(props.entry.date)
const clockIn = ref(props.entry.clockIn)
const clockOut = ref(props.entry.clockOut)

// 既存の休憩があればそれを、無ければ空の 1 行から始める。行が 0 個だと、休憩を
// 入れたいときにまず「追加」を押す必要があり、手間が増える。
const breaks = ref<BreakRow[]>(
  0 < props.entry.breaks.length
    ? props.entry.breaks.map((period) => createBreakRow(period.start, period.end))
    : [createBreakRow()],
)

/** 休憩の入力行を末尾に足す。 */
function addBreak(): void {
  breaks.value.push(createBreakRow())
}

/**
 * 休憩の入力行を取り除く。最後の 1 行は残し、値だけを空にする。行が無くなると
 * 休憩を入れ直す手段が「追加」だけになるためである。
 *
 * @param id - 対象の行の識別子
 */
function removeBreak(id: number): void {
  if (breaks.value.length <= 1) {
    breaks.value = [createBreakRow()]
    return
  }
  breaks.value = breaks.value.filter((row) => row.id !== id)
}

// 直前の送信で見つかった指摘。入力し直せるよう、ダイアログは開いたままにする。
const issue = ref<DayEntryIssue | null>(null)

// 選択中の日付の既存の記録。日付を選び直すたびに再評価される。時刻の入力欄は
// 追従させない。入力の途中で書き換わると、打ち込んだ値が消えてしまうためである。
const existing = computed(() => store.summaryFor(date.value).punches)

const existingCount = computed(() => existing.value.length)

// 同じ種別の打刻が複数ある日は、この入力形式では表せない。保存すると拾えなかった
// 打刻が失われるため、件数だけでなくその事実も伝える。
const isLossy = computed(() => toDayEntry(date.value, existing.value).isLossy)

const title = computed(() =>
  0 < existingCount.value ? '1日分をまとめて修正' : '1日分をまとめて入力',
)

/**
 * 入力を検証し、問題がなければ親へ渡す。
 */
function submit(): void {
  const result = buildDayPunches({
    date: date.value,
    clockIn: clockIn.value,
    clockOut: clockOut.value,
    breaks: breaks.value.map((row) => ({ start: row.start, end: row.end })),
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
  <BaseDialog :open="true" :title="title" @cancel="emit('cancel')">
    <form id="day-entry" class="form" @submit.prevent="submit">
      <label>
        <span>日付</span>
        <input v-model="date" type="date" required :disabled="lockDate" />
      </label>
      <label>
        <span>出勤</span>
        <input v-model="clockIn" type="time" required />
      </label>

      <!-- 休憩は開始と終了を横に並べ、行ごとに追加・削除する。ラベルを左に置く
           形では、狭い画面で時刻の入力欄 2 つが収まらない。 -->
      <fieldset class="breaks">
        <legend>休憩</legend>
        <div v-for="(row, index) in breaks" :key="row.id" class="break-row">
          <input v-model="row.start" type="time" :aria-label="`休憩${index + 1}の開始`" />
          <span class="tilde" aria-hidden="true">〜</span>
          <input v-model="row.end" type="time" :aria-label="`休憩${index + 1}の終了`" />
          <button
            type="button"
            class="remove-break"
            :aria-label="`休憩${index + 1}を削除`"
            @click="removeBreak(row.id)"
          >
            ✕
          </button>
        </div>
        <button type="button" class="add-break" @click="addBreak">休憩を追加</button>
      </fieldset>

      <label>
        <span>退勤</span>
        <input v-model="clockOut" type="time" required />
      </label>
    </form>

    <p class="hint">休憩がない日は、休憩を空欄のままにしてください。</p>

    <!-- 既にその日の記録がある場合、保存すると入れ替わる。取り消せないため、
         保存する前に件数を示す。 -->
    <p v-if="0 < existingCount" class="replace" role="status">
      {{ formatDateLabel(date) }}には既に {{ existingCount }} 件の打刻があります。保存すると入力した内容に置き換わります。
    </p>

    <!-- 出退勤や休憩が複数ある日は、この形式では一部しか表せない。保存すると
         残りが消えるため、打刻画面での修正を案内する。 -->
    <p v-if="isLossy" class="lossy" role="alert">
      この日には出勤または退勤が複数あり、この形式では一部しか表せません。個別に直す場合は打刻画面から修正してください。
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
/* 変更できないことが見て分かるようにする。値は読めたままにしておく必要があるので、
   薄くしすぎない。 */
input:disabled {
  border-style: dashed;
  color: gray;
  background: rgba(128, 128, 128, 0.08);
}
.breaks {
  margin: 0;
  /* 左右の余白は狭くする。休憩行は入力欄 2 つとボタンが並ぶため、ここを広く取ると
     その分だけ入力欄が狭くなる。 */
  padding: 0.5rem 0.45rem 0.6rem;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
legend {
  padding: 0 0.3rem;
  font-size: 0.9rem;
  color: gray;
}
/*
 * grid にして時刻の入力欄に 1fr を割り当てる。flex では入力欄が本来の幅を保とうと
 * するため、狭い画面でダイアログが横にあふれる。1fr と min-width: 0 の組み合わせ
 * なら、残りの幅に合わせて縮む。
 */
.break-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  align-items: center;
  gap: 0.4rem;
}
.tilde {
  color: gray;
}
.remove-break,
.add-break {
  flex: 0 0 auto;
  border-radius: 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.35);
  background: transparent;
  color: gray;
  cursor: pointer;
}
.remove-break {
  width: 2rem;
  height: 2rem;
  line-height: 1;
  font-size: 0.85rem;
}
.remove-break:hover,
.remove-break:focus-visible {
  background: rgba(220, 38, 38, 0.12);
  color: crimson;
}
.add-break {
  align-self: flex-start;
  padding: 0.3rem 0.7rem;
  border-style: dashed;
  font-size: 0.85rem;
}
.add-break:hover,
.add-break:focus-visible {
  background: rgba(128, 128, 128, 0.12);
  color: inherit;
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
.lossy {
  margin: 0.6rem 0 0;
  padding: 0.5rem 0.7rem;
  border-radius: 0.4rem;
  background: rgba(220, 38, 38, 0.1);
  color: crimson;
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
  /* 削除は正方形を保つ。時刻の入力欄 2 つと並ぶため、幅を広げると行が収まらない。 */
  .remove-break {
    width: 44px;
    min-width: 44px;
  }
}

/*
 * 狭い画面では休憩行の時計アイコンを隠す。入力欄の中でアイコンが場所を取るため、
 * 残さないと "12:00" が "12" のように切れて値が読めなくなる。欄をタップすれば
 * 選択画面は開くので、操作手段は失われない。出勤と退勤の欄は横幅いっぱいを使える
 * ため、アイコンはそのまま残す。
 */
@media (max-width: 23.5rem) {
  .break-row input::-webkit-calendar-picker-indicator {
    display: none;
  }
  .break-row {
    gap: 0.3rem;
  }
  .breaks {
    padding-left: 0.35rem;
    padding-right: 0.35rem;
  }
}
</style>
