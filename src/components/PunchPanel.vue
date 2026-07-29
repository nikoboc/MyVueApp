<script setup lang="ts">
import { computed } from 'vue'

import { useNow } from '@/composables/useNow'
import { allowedPunchTypes } from '@/services/attendance'
import { PUNCH_LABELS, STATUS_LABELS } from '@/services/punchLabels'
import { formatDuration, parseDateTime, toClock, todayKey } from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'
import { PUNCH_TYPES, type PunchType } from '@/types/attendance'

/**
 * 今日の打刻を行うパネル。
 *
 * 打刻はこのアプリの主要な操作であり、この画面が担当する状態変更もそれだけで
 * ある。そのため親へ emit せず、ストアのアクションを直接呼ぶ（CLAUDE.md 規約 1）。
 */
const store = useAttendanceStore()

// 1 秒ごとに更新する。時計の表示と、勤務中の経過時間がこれで動く。
const now = useNow()

const today = computed(() => todayKey(now.value))
const summary = computed(() => store.summaryFor(today.value))

// 打刻できる種別。勤務状態から決まるため、休憩中に退勤を押せるといった
// 矛盾した操作がそもそも選べない。
const allowed = computed(() => allowedPunchTypes(summary.value.status))

/**
 * 継続中の勤務または休憩の経過時間。
 *
 * 集計は現在時刻を参照しないため、進行中の区間はここで算出する。`now` に依存する
 * のはこの computed だけであり、確定済みの集計は 1 秒ごとに再計算されない。
 */
const openElapsedMs = computed(() => {
  const since = summary.value.openSince
  if (since === undefined) {
    return 0
  }
  const startedAt = parseDateTime(since)
  return startedAt === undefined ? 0 : Math.max(0, now.value - startedAt)
})

const isRunning = computed(
  () => summary.value.status === 'working' || summary.value.status === 'on-break',
)

const clock = computed(() =>
  new Date(now.value).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
)

/**
 * 打刻できる種別かどうかを判定する。
 *
 * @param type - 判定する種別
 * @returns 現在の勤務状態で打刻できれば true
 */
function canPunch(type: PunchType): boolean {
  return allowed.value.includes(type)
}
</script>

<template>
  <section class="panel">
    <div class="clock">
      <p class="time">{{ clock }}</p>
      <p class="status" :data-status="summary.status">
        {{ STATUS_LABELS[summary.status] }}
        <span v-if="isRunning" class="elapsed">{{ formatDuration(openElapsedMs) }}経過</span>
      </p>
    </div>

    <!-- 4 種類すべてを常に表示し、打刻できないものは無効にする。ボタンの位置が
         状態によって動かないため、押し間違いが起きにくい。 -->
    <div class="actions">
      <button
        v-for="type in PUNCH_TYPES"
        :key="type"
        type="button"
        class="punch"
        :class="type"
        :disabled="!canPunch(type)"
        @click="store.punch(type)"
      >
        {{ PUNCH_LABELS[type] }}
      </button>
    </div>

    <dl class="totals">
      <div>
        <dt>実働</dt>
        <dd>{{ formatDuration(summary.workedMs) }}</dd>
      </div>
      <div>
        <dt>休憩</dt>
        <dd>{{ formatDuration(summary.breakMs) }}</dd>
      </div>
      <div>
        <dt>最終打刻</dt>
        <dd>{{ summary.openSince === undefined ? '—' : toClock(summary.openSince) }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.panel {
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.clock {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}
.time {
  margin: 0;
  font-size: 2.5rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.status {
  margin: 0;
  color: gray;
}
.status[data-status='working'] {
  color: seagreen;
}
.status[data-status='on-break'] {
  color: darkorange;
}
.elapsed {
  margin-left: 0.5rem;
  font-size: 0.85rem;
}
.actions {
  display: grid;
  /* 最小幅を 6rem にしておくと、320px 幅の端末でも 2 列に収まる。7rem では
     1 列になり、4 つのボタンが縦に伸びてしまう。 */
  grid-template-columns: repeat(auto-fit, minmax(6rem, 1fr));
  gap: 0.5rem;
}
.punch {
  padding: 0.9rem 0.5rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: transparent;
  color: inherit;
  font-size: 1rem;
  cursor: pointer;
}
.punch:hover:not(:disabled),
.punch:focus-visible:not(:disabled) {
  background: rgba(128, 128, 128, 0.15);
}
.punch:disabled {
  opacity: 0.4;
  cursor: default;
}
.punch.clock-in:not(:disabled) {
  border-color: seagreen;
  color: seagreen;
}
.punch.clock-out:not(:disabled) {
  border-color: crimson;
  color: crimson;
}
.totals {
  display: flex;
  gap: 2rem;
  margin: 0;
  flex-wrap: wrap;
}
.totals dt {
  font-size: 0.8rem;
  color: gray;
}
.totals dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
