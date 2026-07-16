<script setup lang="ts">
import { computed } from 'vue'

import BaseSpinner from '@/components/BaseSpinner.vue'
import CurrentConditions from '@/components/CurrentConditions.vue'
import { useWeatherStore } from '@/stores/useWeatherStore'
import type { Location } from '@/types/weather'

/**
 * One city on the dashboard.
 *
 * The card receives its *identity* as a prop but looks its *data* up in the
 * store (CLAUDE.md rule 1). That split matters: if App passed the forecast down
 * too, App would have to track every card's data and re-pass it on refresh.
 * Instead each card subscribes to the one slot it cares about.
 */
const props = defineProps<{ location: Location }>()

const store = useWeatherStore()

// `computed` here is not decoration: it re-evaluates when the store's forecasts
// map changes, which is what repaints the card after a refresh. Under
// `noUncheckedIndexedAccess` the lookup is `Forecast | undefined`, so the
// template is forced to handle the not-yet-loaded case.
const forecast = computed(() => store.forecasts[props.location.id])
const isLoading = computed(() => store.loadingIds.has(props.location.id))
</script>

<template>
  <article class="card">
    <header>
      <h2>{{ location.name }}</h2>
      <p class="country">{{ location.country }}</p>
    </header>

    <!-- v-if / v-else-if / v-else: exactly one branch renders. The order is
         deliberate — a card mid-refresh keeps showing its old reading only if
         we check `isLoading` after `forecast`; checking it first (as here) means
         the spinner wins, which is the honest signal while data is in flight. -->
    <BaseSpinner v-if="isLoading" label="Loading forecast…" />
    <CurrentConditions v-else-if="forecast" :current="forecast.current" />
    <p v-else class="unavailable">No forecast available.</p>
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
h2 {
  margin: 0;
  font-size: 1.25rem;
}
.country {
  margin: 0.125rem 0 0;
  font-size: 0.85rem;
  color: gray;
}
.unavailable {
  margin: 0;
  color: gray;
}
</style>
