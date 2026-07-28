<script setup lang="ts">
import { computed } from 'vue'

import { describeWeather } from '@/services/weatherCodes'
import type { CurrentWeather } from '@/types/weather'

/**
 * 表示のみを担当するコンポーネント。描画に必要なデータはすべて props で受け取る
 * （props down）。ストアを参照せず、データ取得も行わないため、再利用が容易であり
 * 動作の追跡もしやすい。入力のみで出力が決まる関数に相当する。
 */
const props = defineProps<{ current: CurrentWeather }>()

// 分割代入は行わず `props.x` の形で参照する。分割代入するとリアクティブな
// プロキシから値がコピーされ、予報を更新してもそのコピーは変化しない。
const description = computed(() => describeWeather(props.current.weatherCode))

// Open-Meteo の既定はメートル法である（°C、%、km/h）。単位の切り替えは
// ストレッチ課題であるため、当面は単位を固定し、ここでラベルとして表示する。
const temperature = computed(() => Math.round(props.current.temperature))
const windSpeed = computed(() => Math.round(props.current.windSpeed))
</script>

<template>
  <div class="conditions">
    <div class="headline">
      <span class="icon" aria-hidden="true">{{ description.icon }}</span>
      <div>
        <p class="temperature">{{ temperature }}°C</p>
        <p class="label">{{ description.label }}</p>
      </div>
    </div>

    <dl class="details">
      <div>
        <dt>湿度</dt>
        <dd>{{ current.humidity }}%</dd>
      </div>
      <div>
        <dt>風速</dt>
        <dd>{{ windSpeed }} km/h</dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.conditions {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.headline {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.icon {
  font-size: 2.5rem;
  line-height: 1;
}
.temperature {
  margin: 0;
  font-size: 2rem;
  font-weight: 600;
}
.label {
  margin: 0;
  color: gray;
}
.details {
  display: flex;
  gap: 2rem;
  margin: 0;
}
.details dt {
  font-size: 0.8rem;
  color: gray;
}
.details dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
}
</style>
