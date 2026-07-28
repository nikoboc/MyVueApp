<script setup lang="ts">
import { computed } from 'vue'

import BaseSpinner from '@/components/BaseSpinner.vue'
import CurrentConditions from '@/components/CurrentConditions.vue'
import HourlyChart from '@/components/HourlyChart.vue'
import { useTimeAgo } from '@/composables/useTimeAgo'
import { useWeatherStore } from '@/stores/useWeatherStore'
import type { HourlySeries, Location } from '@/types/weather'

/** グラフに描画する時間別データの長さ。1 日分に相当する。 */
const HOURS_IN_WINDOW = 24

/**
 * ダッシュボード上の 1 都市を表すカード。
 *
 * カードは対象の地点を prop で受け取るが、その地点のデータはストアから参照する
 * （CLAUDE.md 規約 1）。一方、削除の可否を決定するのは親の役割であるため、カードは
 * `remove` を emit し、ストアのアクションは App が呼び出す（events up。規約 2）。
 * LocationSearch が追加のために `select` を emit するのと対をなす構造である。
 */
const props = defineProps<{ location: Location }>()
const emit = defineEmits<{ (e: 'remove', id: string): void }>()

const store = useWeatherStore()

// `computed` はストアの forecasts が変化すると再評価される。更新後にカードが
// 再描画されるのはこのためである。`noUncheckedIndexedAccess` が有効であるため
// この参照の型は `Forecast | undefined` となり、テンプレート側でも未取得の場合を
// 必ず扱うことになる。
const forecast = computed(() => store.forecasts[props.location.id])
const isLoading = computed(() => store.loadingIds.has(props.location.id))

// ゲッターの形で渡すことでリアクティブなまま保たれる。更新後の予報は新しい
// `fetchedAt` を持つため、表示は自動的に「たった今」へ戻る。
const updatedLabel = useTimeAgo(() => forecast.value?.fetchedAt)

/**
 * 現在時刻から始まる 24 時間分のデータ。API は当日の 0 時を起点に 7 日分
 * （168 点）を返すため、ここで切り出さない場合、夜間でもグラフが早朝の時間帯を
 * 表示し続ける。`hourly` と `current.time` の双方を参照できるこの位置で算出する
 * ことにより、HourlyChart は渡されたデータを描画するだけで済み、表示に専念した
 * 再利用可能なコンポーネントとして維持できる。
 */
const hourlyWindow = computed<HourlySeries | undefined>(() => {
  const current = forecast.value
  if (!current) {
    return undefined
  }
  const startIndex = current.hourly.times.findIndex((time) => current.current.time <= time)
  const from = startIndex < 0 ? 0 : startIndex
  return {
    times: current.hourly.times.slice(from, from + HOURS_IN_WINDOW),
    temperatures: current.hourly.temperatures.slice(from, from + HOURS_IN_WINDOW),
  }
})
</script>

<template>
  <article class="card">
    <header>
      <div>
        <h2>{{ location.name }}</h2>
        <p class="country">{{ location.country }}</p>
      </div>
      <button
        type="button"
        class="remove"
        :aria-label="`${location.name}を削除`"
        @click="emit('remove', location.id)"
      >
        ✕
      </button>
    </header>

    <!-- 描画されるのは常にいずれか 1 つの分岐のみである。取得中はスピナーを
         優先するため、更新中のカードには古いデータではなく読み込み中である
         ことが表示される。 -->
    <BaseSpinner v-if="isLoading" label="予報を読み込み中…" />
    <template v-else-if="forecast && hourlyWindow">
      <CurrentConditions :current="forecast.current" />
      <HourlyChart :series="hourlyWindow" />
      <p class="updated">更新: {{ updatedLabel }}</p>
    </template>
    <p v-else class="unavailable">予報を取得できませんでした。</p>
  </article>
</template>

<style scoped>
.card {
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.75rem;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}
h2 {
  margin: 0;
  font-size: 1.25rem;
}
.country {
  margin: 0.125rem 0 0;
  font-size: 0.85rem;
  color: gray;
}
.remove {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.5rem;
  background: transparent;
  color: gray;
  cursor: pointer;
  line-height: 1;
  font-size: 0.9rem;
}
.remove:hover,
.remove:focus-visible {
  background: rgba(220, 38, 38, 0.12);
  color: crimson;
}
.updated {
  margin: 0;
  font-size: 0.75rem;
  color: gray;
}
.unavailable {
  margin: 0;
  color: gray;
}
</style>
