<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import DayEntryDialog from '@/components/DayEntryDialog.vue'
import { useNow } from '@/composables/useNow'
import { toDayEntry } from '@/services/attendance'
import { describeIssue } from '@/services/punchLabels'
import {
  currentMonthKey,
  formatDateLabel,
  formatDayInMonthLabel,
  formatDuration,
  formatMonthLabel,
  isMonthKey,
  shiftMonth,
  todayKey,
  toMonthKey,
} from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'
import type { DayEntry, DaySummary, PunchDraft } from '@/types/attendance'

/** 当月かどうかの判定を更新する間隔。日付が変わったときに追随できればよい。 */
const TICK_MS = 60_000

/**
 * 月次集計画面。1 か月分の実働時間と、日ごとの内訳を表示する。
 *
 * 対象の月は URL から取り、省略された場合は当月とする。こうしておくと、特定の月を
 * ブックマークしたり共有したりできる。
 */
const store = useAttendanceStore()
const route = useRoute()
const router = useRouter()
const now = useNow(TICK_MS)

const month = computed(() => {
  // URL の値は利用者が自由に書き換えられるため、そのまま信用せず形式を確認する
  // （docs/05 §6）。不正なら当月へ読み替える。
  const param = route.params.month
  const value = Array.isArray(param) ? param[0] : param
  return value !== undefined && isMonthKey(value) ? value : currentMonthKey(now.value)
})

const summary = computed(() => store.monthSummaryFor(month.value))

const hasRecords = computed(() => 0 < summary.value.dayCount)

const isCurrentMonth = computed(() => month.value === currentMonthKey(now.value))

// 文言はテンプレートに直接書かず、ここで組み立てる。テンプレート内で改行すると
// その位置に空白が入り、日本語では文の途中に隙間ができてしまう。
const issueNotice = computed(
  () =>
    `要確認の日が ${summary.value.issueDayCount} 日あります。` +
    '打刻が対になっていない日は、その分の時間が実働に含まれていません。',
)

/**
 * 表示する月を移動する。
 *
 * @param offset - 移動する月数。負の値で過去へ移動する
 */
function goToMonth(offset: number): void {
  void router.push({ name: 'monthly', params: { month: shiftMonth(month.value, offset) } })
}

// 編集中の内容。`null` のときはダイアログを開かない。追加と修正で同じダイアログを
// 使い、初期値と日付を変更できるかどうかだけを差し替える。両者は必ず対で決まる
// ため、1 つの状態にまとめておく。
const editing = ref<{ entry: DayEntry; lockDate: boolean } | null>(null)

// 追加時の日付の初期値。当月を見ているなら今日、過去や未来の月を見ているなら
// その月の 1 日とする。いま画面に出ている月の日付が入るため、選び直す手間が減る。
const defaultDate = computed(() =>
  isCurrentMonth.value ? todayKey(now.value) : `${month.value}-01`,
)

/** 空の入力でダイアログを開く。どの日に記録するかはこれから決めるため、日付は選べる。 */
function startAdding(): void {
  editing.value = {
    entry: { date: defaultDate.value, clockIn: '', clockOut: '', breaks: [] },
    lockDate: false,
  }
}

/**
 * 既存の 1 日分を初期値としてダイアログを開く。対象の日は決まっているため、
 * 日付は変更できないようにする。
 *
 * @param day - 対象の日の集計
 */
function startEditing(day: DaySummary): void {
  editing.value = { entry: toDayEntry(day.date, day.punches).entry, lockDate: true }
}

/**
 * 入力された 1 日分を保存する。日ごとのカードと違い、記録が 1 件も無い日も
 * 対象にできる。
 *
 * 表示中の月以外の日付が入力された場合は、その月へ移動する。保存したものが
 * 画面から消えたように見えるのを避けるためである。
 *
 * @param date - 対象の日付キー "YYYY-MM-DD"
 * @param punches - その日の打刻
 */
function saveDay(date: string, punches: readonly PunchDraft[]): void {
  if (!store.replaceDay(date, punches)) {
    // 保存に失敗したときはダイアログを開いたままにして、入力をやり直せるようにする。
    return
  }
  editing.value = null

  const added = toMonthKey(date)
  if (added !== month.value) {
    void router.push({ name: 'monthly', params: { month: added } })
  }
}
</script>

<template>
  <div class="view">
    <section class="selector">
      <button type="button" aria-label="前の月" @click="goToMonth(-1)">←</button>
      <h2>{{ formatMonthLabel(month) }}</h2>
      <button type="button" aria-label="次の月" @click="goToMonth(1)">→</button>
    </section>

    <dl class="totals">
      <div>
        <dt>実働合計</dt>
        <dd class="primary">{{ formatDuration(summary.workedMs) }}</dd>
      </div>
      <div>
        <dt>休憩合計</dt>
        <dd>{{ formatDuration(summary.breakMs) }}</dd>
      </div>
      <div>
        <dt>勤務日数</dt>
        <dd>{{ summary.dayCount }}日</dd>
      </div>
      <div>
        <dt>1日平均</dt>
        <dd>{{ formatDuration(summary.averageWorkedMs) }}</dd>
      </div>
    </dl>

    <!-- 打刻漏れのある日は集計に含まれない時間が生じる。合計だけを見て判断しない
         よう、件数を明示する。 -->
    <p v-if="0 < summary.issueDayCount" class="issues" role="status">{{ issueNotice }}</p>

    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>

    <!-- 記録が 1 件も無い日は日ごとのカードが存在せず、打刻画面からは追加できない。
         丸ごと打刻を忘れた日を後から補えるよう、ここでは日付も選ばせる。 -->
    <section class="add">
      <button type="button" class="add-button" @click="startAdding">過去の記録を追加</button>
    </section>

    <!-- v-if で開くたびに作り直す。前回の入力が残っていると、続けて別の日を
         扱うときに古い時刻を保存してしまう。 -->
    <DayEntryDialog
      v-if="editing !== null"
      :entry="editing.entry"
      :lock-date="editing.lockDate"
      @submit="saveDay"
      @cancel="editing = null"
    />

    <ul v-if="hasRecords" class="days">
      <li v-for="day in summary.days" :key="day.date">
        <!-- 日付は日と曜日だけにする。年と月は見出しに出ているため、ここで
             繰り返すと狭い画面で行が折り返してしまう。読み上げには
             aria-label で完全な日付を渡す。 -->
        <div class="row">
          <span class="date">{{ formatDayInMonthLabel(day.date) }}</span>
          <span class="worked">{{ formatDuration(day.workedMs) }}</span>
          <span class="break">休憩 {{ formatDuration(day.breakMs) }}</span>
          <button
            type="button"
            class="edit"
            :aria-label="`${formatDateLabel(day.date)}を修正`"
            @click="startEditing(day)"
          >
            修正
          </button>
        </div>
        <p v-if="0 < day.issues.length" class="day-issues">
          {{ day.issues.map(describeIssue).join(' / ') }}
        </p>
      </li>
    </ul>

    <p v-else class="empty">
      <span>{{ formatMonthLabel(month) }}の打刻はありません。</span>
      <span v-if="isCurrentMonth">打刻画面から記録を始めてください。</span>
    </p>
  </div>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.selector h2 {
  margin: 0;
  font-size: 1.25rem;
}
.selector button {
  min-width: 3rem;
  min-height: 44px;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 1.1rem;
}
.selector button:hover,
.selector button:focus-visible {
  background: rgba(128, 128, 128, 0.15);
}
.totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.75rem 1rem;
  margin: 0;
  padding: 1rem 1.25rem;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.75rem;
}
.totals dt {
  font-size: 0.8rem;
  color: gray;
}
.totals dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-size: 1.05rem;
}
.totals .primary {
  font-size: 1.5rem;
  font-weight: 600;
}
.issues {
  margin: 0;
  padding: 0.6rem 0.85rem;
  border-radius: 0.5rem;
  background: rgba(220, 38, 38, 0.1);
  color: crimson;
  font-size: 0.85rem;
  line-height: 1.5;
}
.error {
  margin: 0;
  color: crimson;
}
.add {
  display: flex;
}
.add-button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px dashed rgba(128, 128, 128, 0.5);
  background: transparent;
  color: gray;
  cursor: pointer;
  font-size: 0.9rem;
}
.add-button:hover,
.add-button:focus-visible {
  background: rgba(128, 128, 128, 0.12);
  color: inherit;
}

@media (pointer: coarse) {
  .add-button {
    min-height: 44px;
  }
}
.days {
  list-style: none;
  margin: 0;
  padding: 0;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}
.days > li {
  padding: 0.6rem 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.15);
}
/*
 * 配置は grid で明示する。flex の折り返しに任せると、幅が足りなくなったときに
 * 修正ボタンだけが次の行の左端へ落ちて、どの日のボタンか分からなくなる。
 */
.row {
  display: grid;
  grid-template-columns: auto auto 1fr auto;
  grid-template-areas: 'date worked break edit';
  align-items: center;
  gap: 0.2rem 0.6rem;
}
/* 各項目は途中で折り返さない。数字や曜日が分断されると読みにくくなる。 */
.date,
.worked,
.break {
  white-space: nowrap;
}
.date {
  grid-area: date;
  min-width: 4.5rem;
}
.worked {
  grid-area: worked;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.break {
  grid-area: break;
  font-size: 0.85rem;
  color: gray;
  font-variant-numeric: tabular-nums;
}
.edit {
  grid-area: edit;
}

/* 幅が足りない端末では休憩を次の行へ送る。1 行に詰め込むと休憩の数値が
   省略され、「休憩 …」とラベルだけが残ってしまう。 */
@media (max-width: 23.5rem) {
  .row {
    grid-template-columns: auto 1fr auto;
    grid-template-areas:
      'date worked edit'
      'break break break';
  }
}
.edit {
  justify-self: end;
  padding: 0.2rem 0.6rem;
  border-radius: 0.4rem;
  border: 1px solid rgba(128, 128, 128, 0.3);
  background: transparent;
  color: gray;
  cursor: pointer;
  font-size: 0.8rem;
  white-space: nowrap;
}
.edit:hover,
.edit:focus-visible {
  background: rgba(128, 128, 128, 0.15);
  color: inherit;
}

@media (pointer: coarse) {
  .edit {
    min-height: 44px;
    min-width: 44px;
    padding: 0.4rem 0.9rem;
    font-size: 0.9rem;
  }
}
.day-issues {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: crimson;
}
.empty {
  margin: 0;
  padding: 2rem;
  text-align: center;
  color: gray;
  border: 1px dashed rgba(128, 128, 128, 0.4);
  border-radius: 0.75rem;
  line-height: 1.6;
  /* 2 つの文を続けて表示しつつ、狭い画面では文の切れ目で折り返す。 */
  display: flex;
  flex-direction: column;
}
</style>
