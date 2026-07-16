<script setup lang="ts">
import LocationCard from '@/components/LocationCard.vue'
import LocationSearch from '@/components/LocationSearch.vue'
import { useWeatherStore } from '@/stores/useWeatherStore'

// App composes the pieces and owns almost no logic: the store holds the state,
// the children render it. Phase 2's `<pre>` state dump is gone — the cards are
// the view of the store now.
const store = useWeatherStore()
</script>

<template>
  <main class="app">
    <header>
      <h1>WeatherBoard</h1>
      <p class="subtitle">Phase 3 — components, props down / events up</p>
    </header>

    <!-- The whole round trip in one line: the child announces a pick, App turns
         that into a store action, the store fetches and mutates state, and every
         component reading that state repaints itself. -->
    <LocationSearch @select="store.addLocation" />

    <p v-if="store.error" class="error" role="alert">{{ store.error }}</p>

    <section class="board">
      <LocationCard
        v-for="location in store.locations"
        :key="location.id"
        :location="location"
      />
    </section>
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
</style>
