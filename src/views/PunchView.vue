<script setup lang="ts">
import { computed } from 'vue'

import DayCard from '@/components/DayCard.vue'
import PunchPanel from '@/components/PunchPanel.vue'
import { useAttendanceStore } from '@/stores/useAttendanceStore'

/**
 * 打刻画面。今日の打刻と、日ごとの記録の一覧を表示する。
 *
 * 画面を構成するだけでロジックは持たない。状態はストアが保持し、描画は子
 * コンポーネントが担当する。
 */
const store = useAttendanceStore()

const hasRecords = computed(() => 0 < store.days.length)
</script>

<template>
  <div class="view">
    <PunchPanel />

    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>

    <section v-if="hasRecords" class="history">
      <h2>記録</h2>
      <!-- 日付キーを :key に使う。日ごとの並び替えや削除が起きても、Vue は
           対応するカードを取り違えずに差分更新できる。 -->
      <DayCard v-for="day in store.days" :key="day.date" :summary="day" />
    </section>

    <!-- 記録が 1 件も無い場合の表示。これが無いと画面が空白となり、未打刻の
         状態なのか不具合なのかを区別できない。 -->
    <p v-else class="empty">まだ打刻がありません。上のボタンから出勤を記録してください。</p>
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
.history {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.history h2 {
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
