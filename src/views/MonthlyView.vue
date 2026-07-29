<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useNow } from '@/composables/useNow'
import { describeIssue } from '@/services/punchLabels'
import {
  currentMonthKey,
  formatDateLabel,
  formatDuration,
  formatMonthLabel,
  isMonthKey,
  shiftMonth,
} from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'

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

    <ul v-if="hasRecords" class="days">
      <li v-for="day in summary.days" :key="day.date">
        <div class="row">
          <span class="date">{{ formatDateLabel(day.date) }}</span>
          <span class="worked">{{ formatDuration(day.workedMs) }}</span>
          <span class="break">休憩 {{ formatDuration(day.breakMs) }}</span>
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
.row {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  flex-wrap: wrap;
}
.date {
  flex: 1;
  min-width: 8rem;
}
.worked {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.break {
  font-size: 0.85rem;
  color: gray;
  font-variant-numeric: tabular-nums;
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
