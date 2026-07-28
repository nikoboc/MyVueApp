<script setup lang="ts">
import { computed } from 'vue'

import LocationCard from '@/components/LocationCard.vue'
import LocationSearch from '@/components/LocationSearch.vue'
import { useAutoRefresh } from '@/composables/useAutoRefresh'
import { useWeatherStore } from '@/stores/useWeatherStore'

/** 10 分ごとに再取得する。天気の変化は緩やかであり、無料 API への負荷も抑えられる。 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000

// App はコンポーネントを組み合わせるだけで、ロジックはほとんど持たない。状態は
// ストアが保持し、描画は子コンポーネントが担当する。
const store = useWeatherStore()

const hasLocations = computed(() => 0 < store.locations.length)

// 自動更新をルートに配置することで、アプリケーションの動作中は常に有効となる。
// タイマーは App のマウント時に開始し、アンマウント時にコンポーザブルの内部で
// 破棄される。地点が 1 件も無い場合、refreshAll は何も行わずに終了する。
useAutoRefresh(() => {
  void store.refreshAll()
}, REFRESH_INTERVAL_MS)
</script>

<template>
  <main class="app">
    <header>
      <h1>WeatherBoard</h1>
      <p class="subtitle">フェーズ 5 — 自動更新、更新時刻の表示、地点の削除</p>
    </header>

    <!-- 一連の流れがこの 1 行に集約されている。子が選択を通知し、App がそれを
         ストアのアクションへ接続し、ストアが取得して状態を更新する。その状態を
         参照するすべてのコンポーネントが再描画される。削除も方向が逆になるだけで
         同じ構造である。 -->
    <LocationSearch @select="store.addLocation" />

    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>

    <section v-if="hasLocations" class="board">
      <LocationCard
        v-for="location in store.locations"
        :key="location.id"
        :location="location"
        @remove="store.removeLocation"
      />
    </section>

    <!-- 地点が 1 件も無い場合の表示。これが無いと画面が空白となり、未追加の
         状態なのか不具合なのかを区別できない。 -->
    <p v-else class="empty">上の検索ボックスから都市を追加してください。</p>
  </main>
</template>

<style scoped>
.app {
  max-width: 44rem;
  margin: 3rem auto;
  padding: 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
header {
  margin-bottom: -0.5rem;
}
h1 {
  margin: 0;
}
.subtitle {
  margin: 0.25rem 0 0;
  color: gray;
}
.error {
  margin: 0;
  color: crimson;
}
.board {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
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
