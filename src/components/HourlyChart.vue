<script setup lang="ts">
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  type ChartData,
  type ChartOptions,
} from 'chart.js'
import { computed } from 'vue'
import { Line } from 'vue-chartjs'

import type { HourlySeries } from '@/types/weather'

/**
 * 24 時間分の気温を表示する折れ線グラフ。本プロジェクトで最初に導入する
 * Vue 以外のライブラリでもある。
 *
 * Chart.js は tree-shaking を前提とした構成であり、初期状態では何も登録されて
 * いない。そのため、このグラフが使用する要素のみを明示的に登録する。`register`
 * はモジュールの副作用としてグローバルに作用するため、このコンポーネントを
 * 一度 import すれば、すべてのインスタンスで有効となる。
 */
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const props = defineProps<{ series: HourlySeries }>()

/**
 * Chart.js へデータを受け渡す部分。`props.series` から生成した `computed` で
 * あるため、新しい予報が届いて prop の内容が変化すると再計算される。以降は
 * vue-chartjs が `:data` の差分を検出し、新しい線までアニメーションする。
 * Chart.js の API を直接呼び出す必要も、`watch` を記述する必要もない。ライブラリの
 * 境界を越えてリアクティビティが機能するこの仕組みが、本フェーズの主題である。
 */
const chartData = computed<ChartData<'line'>>(() => ({
  // Open-Meteo が返すのは、現地時刻でタイムゾーン情報を持たない文字列である
  // （"2026-07-14T18:00"）。`new Date()` を経由するとタイムゾーンのずれが
  // 生じるため、"HH:MM" の部分を文字列として切り出す。
  labels: props.series.times.map((iso) => iso.slice(11, 16)),
  datasets: [
    {
      label: '気温（°C）',
      // Chart.js は渡された配列を内部で変更するため、コピーを渡す。ドメイン側の
      // `temperatures` は `readonly` のまま維持する。
      data: [...props.series.temperatures],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      fill: true,
      tension: 0.3,
      pointRadius: 0,
      pointHoverRadius: 4,
      borderWidth: 2,
    },
  ],
}))

// オプションはリアクティブな状態に依存しないため、`computed` ではなく通常の
// const とする。描画のたびに再生成しても処理が増えるだけである。
const chartOptions: ChartOptions<'line'> = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      // 24 個の時刻ラベルをすべて表示すると重なるため、4 つおき程度に間引く。
      // 回転させず水平のまま表示し、可読性を保つ。
      ticks: { color: 'rgba(128,128,128,0.9)', maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
    },
    y: {
      grid: { color: 'rgba(128,128,128,0.15)' },
      ticks: { color: 'rgba(128,128,128,0.9)' },
    },
  },
}
</script>

<template>
  <!-- Chart.js は描画先としてサイズの確定したブロックを必要とする。
       maintainAspectRatio:false の場合、キャンバスはこの要素の全体に広がるため、
       高さの指定をここに配置する。 -->
  <div class="chart">
    <Line :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.chart {
  height: 9rem;
  margin-top: 0.25rem;
}
</style>
