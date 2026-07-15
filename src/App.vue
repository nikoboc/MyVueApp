<script setup lang="ts">
import { computed, ref } from 'vue'

import { useWeatherStore } from '@/stores/useWeatherStore'

// The store is the single source of truth. This bare Phase 2 UI just drives the
// store's actions and dumps its state, so we can watch reactivity in the browser
// before building real components in Phase 3.
const store = useWeatherStore()

const query = ref('')

/** Search for the typed city and add its first match to the dashboard. */
async function addLocation(): Promise<void> {
  const matches = await store.searchLocations(query.value)
  const first = matches[0]
  if (!first) {
    return
  }
  await store.addLocation(first)
  query.value = ''
}

// Compact view of store state — the full forecasts (168 hourly points each)
// would be too noisy to eyeball, so summarise each one.
const debugText = computed(() =>
  JSON.stringify(
    {
      locations: store.locations,
      loading: [...store.loadingIds],
      error: store.error,
      forecasts: Object.fromEntries(
        Object.entries(store.forecasts).map(([id, forecast]) => [
          id,
          {
            temperature: forecast.current.temperature,
            hourlyPoints: forecast.hourly.temperatures.length,
            dailyDays: forecast.daily.dates.length,
            fetchedAt: forecast.fetchedAt,
          },
        ]),
      ),
    },
    null,
    2,
  ),
)
</script>

<template>
  <main class="app">
    <header>
      <h1>WeatherBoard</h1>
      <p class="subtitle">Phase 2 — Pinia store wired to the service (bare UI)</p>
    </header>

    <section class="controls">
      <form class="search" @submit.prevent="addLocation">
        <input v-model="query" type="text" placeholder="City name, e.g. Berlin" />
        <button type="submit">Add location</button>
      </form>
      <p v-if="store.error" class="error">{{ store.error }}</p>
    </section>

    <section>
      <h2>Store state</h2>
      <pre class="dump">{{ debugText }}</pre>
    </section>
  </main>
</template>

<style scoped>
.app {
  max-width: 44rem;
  margin: 3rem auto;
  padding: 0 1.5rem;
}
.subtitle {
  color: gray;
  margin-top: -0.5rem;
}
.search {
  display: flex;
  gap: 0.5rem;
}
input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  font-size: 1rem;
}
button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  cursor: pointer;
  font-size: 1rem;
}
.error {
  color: crimson;
}
.dump {
  background: rgba(128, 128, 128, 0.12);
  border-radius: 0.5rem;
  padding: 1rem;
  overflow-x: auto;
  font-size: 0.85rem;
}
</style>
