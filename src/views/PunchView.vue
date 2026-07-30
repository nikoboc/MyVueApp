<script setup lang="ts">
import { computed } from 'vue'

import DayCard from '@/components/DayCard.vue'
import PunchPanel from '@/components/PunchPanel.vue'
import { useNow } from '@/composables/useNow'
import { todayKey } from '@/services/time'
import { useAttendanceStore } from '@/stores/useAttendanceStore'

/** 日付が変わったことに気づければよいため、更新は 1 分ごとで足りる。 */
const TICK_MS = 60_000

/**
 * 打刻画面。今日の打刻と、その日の記録だけを表示する。
 *
 * 過去の日は表示しない。日を追うごとにカードが積み上がり、いま打刻すべきかどうかを
 * 判断したいだけの画面が長くなってしまう。過去の記録は月次集計で一覧でき、修正も
 * そちらのダイアログから行える。
 *
 * 画面を構成するだけでロジックは持たない。状態はストアが保持し、描画は子
 * コンポーネントが担当する。
 */
const store = useAttendanceStore()
const now = useNow(TICK_MS)

const today = computed(() => todayKey(now.value))

// `days` は打刻がある日だけを含むため、見つからなければ今日の記録は無い。日付が
// 変われば `today` が変わり、表示も自動的に切り替わる。
const todaySummary = computed(() => store.days.find((day) => day.date === today.value))
</script>

<template>
  <div class="view">
    <PunchPanel />

    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>

    <section v-if="todaySummary !== undefined" class="today">
      <h2>今日の記録</h2>
      <DayCard :summary="todaySummary" />
    </section>

    <!-- 打刻が無い場合の表示。これが無いと画面が空白となり、未打刻の状態なのか
         不具合なのかを区別できない。 -->
    <p v-else class="empty">今日の打刻はまだありません。上のボタンから記録を始めてください。</p>
  </div>
</template>

<style scoped>
.view {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
.error {
  margin: 0;
  color: crimson;
}
.today {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.today h2 {
  margin: 0;
  font-size: 1rem;
  color: gray;
  font-weight: 600;
}
.empty {
  margin: 0;
  padding: 2rem;
  text-align: center;
  color: gray;
  border: 1px dashed rgba(128, 128, 128, 0.4);
  border-radius: 0.75rem;
}
</style>
