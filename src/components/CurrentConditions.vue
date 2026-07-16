<script setup lang="ts">
import { computed } from 'vue'

import { describeWeather } from '@/services/weatherCodes'
import type { CurrentWeather } from '@/types/weather'

/**
 * Pure presentational component: everything it renders arrives through props
 * ("props down"). It never reads the store and never fetches, so it is trivial
 * to reuse and to reason about — the Vue equivalent of a function of its inputs.
 */
const props = defineProps<{ current: CurrentWeather }>()

// Read through `props.x` rather than destructuring. Destructuring copies the
// value out of the reactive proxy, so the copy would never update when the
// forecast refreshes — the reactivity trap worth internalising early.
const description = computed(() => describeWeather(props.current.weatherCode))

// Open-Meteo's defaults are metric (°C, %, km/h). A unit toggle is a later
// stretch goal; until then the units are fixed and labelled here.
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
        <dt>Humidity</dt>
        <dd>{{ current.humidity }}%</dd>
      </div>
      <div>
        <dt>Wind</dt>
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
