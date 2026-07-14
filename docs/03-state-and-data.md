# 03 — State & Data

This is the heart of the app. Get the store and the data models right and the components almost write
themselves.

## Typed domain models (`src/types/weather.ts`)

Define the shapes first — as a Java dev, this is your comfort zone and it pays off everywhere else.

```ts
// A place the user searched for and added.
export interface Location {
  id: string          // stable key for v-for, e.g. `${latitude},${longitude}`
  name: string        // "Berlin"
  country: string     // "Germany"
  latitude: number
  longitude: number
}

// Current conditions, normalized from the API response.
export interface CurrentWeather {
  temperature: number
  humidity: number
  windSpeed: number
  weatherCode: number // WMO code -> label/icon via weatherCodes.ts
  time: string        // ISO timestamp from the API
}

// Parallel arrays (Chart.js-friendly): times[i] pairs with temperatures[i].
export interface HourlySeries {
  times: string[]
  temperatures: number[]
}

export interface DailySeries {
  dates: string[]
  tempMax: number[]
  tempMin: number[]
  weatherCodes: number[]
}

// Everything we hold for one location.
export interface Forecast {
  current: CurrentWeather
  hourly: HourlySeries
  daily: DailySeries
  fetchedAt: number   // Date.now() when stored; drives "last updated"
}
```

## Open-Meteo API (`src/services/weatherApi.ts`)

Two endpoints, no API key, CORS-enabled. Official docs: https://open-meteo.com/en/docs

### 1. Geocoding — city name → coordinates

```
GET https://geocoding-api.open-meteo.com/v1/search?name=Berlin&count=5&language=en&format=json
```

Response (trimmed):

```json
{
  "results": [
    { "id": 2950159, "name": "Berlin", "latitude": 52.52, "longitude": 13.41,
      "country": "Germany", "admin1": "Berlin" }
  ]
}
```

> Note: when there are no matches, the API omits `results` entirely (the key is absent, not an empty
> array). Handle that — `data.results ?? []`.

### 2. Forecast — coordinates → weather

```
GET https://api.open-meteo.com/v1/forecast
    ?latitude=52.52&longitude=13.41
    &current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
    &hourly=temperature_2m
    &daily=temperature_2m_max,temperature_2m_min,weather_code
    &timezone=auto
    &forecast_days=7
```

Response (trimmed):

```json
{
  "current": {
    "time": "2026-07-14T18:00",
    "temperature_2m": 21.3,
    "relative_humidity_2m": 55,
    "wind_speed_10m": 12.4,
    "weather_code": 3
  },
  "hourly": {
    "time": ["2026-07-14T00:00", "..."],
    "temperature_2m": [18.1, 17.6, "..."]
  },
  "daily": {
    "time": ["2026-07-14", "..."],
    "temperature_2m_max": [24.0, "..."],
    "temperature_2m_min": [14.0, "..."],
    "weather_code": [3, "..."]
  }
}
```

### Service shape

The service returns **our** domain types, not the raw API JSON. Mapping (anti-corruption layer) lives
here so the rest of the app never sees Open-Meteo's field names — the same reason you'd map a DTO to a
domain object in Java.

```ts
export async function geocode(query: string): Promise<Location[]> { /* fetch + map */ }
export async function getForecast(loc: Location): Promise<Forecast> { /* fetch + map */ }
```

Add a tiny `unit` note: request params can include `temperature_unit=fahrenheit`,
`wind_speed_unit=mph` for the stretch unit-toggle feature.

### WMO weather codes (`src/services/weatherCodes.ts`)

Open-Meteo uses [WMO codes](https://open-meteo.com/en/docs) (0 = clear, 1–3 = partly cloudy, 45/48 = fog,
51–67 = rain, 71–77 = snow, 80–82 = showers, 95–99 = thunderstorm). A simple lookup map:

```ts
export const weatherCodes: Record<number, { label: string; icon: string }> = {
  0: { label: "Clear sky", icon: "☀️" },
  3: { label: "Overcast", icon: "☁️" },
  // ...fill in the rest
}
```

## The Pinia store (`src/stores/useWeatherStore.ts`)

Pinia is where global reactive state lives. Mental model: **one store ≈ one singleton service bean** that
holds state and exposes methods. Components inject it and call its actions.

### Anatomy

Pinia (setup-style) has three parts:

| Part | Is | Java analogy |
|------|----|--------------|
| **state** | reactive fields (`ref`) | the bean's instance fields |
| **getters** | derived, cached values (`computed`) | cached getters / derived properties |
| **actions** | methods, can be async, mutate state | the bean's service methods |

### Design

```ts
import { defineStore } from "pinia"
import { ref } from "vue"
import type { Location, Forecast } from "@/types/weather"
import { geocode, getForecast } from "@/services/weatherApi"

export const useWeatherStore = defineStore("weather", () => {
  // ---- state ----
  const locations = ref<Location[]>([])
  const forecasts = ref<Record<string, Forecast>>({})   // keyed by location.id
  const loadingIds = ref<Set<string>>(new Set())         // which cards are fetching
  const error = ref<string | null>(null)

  // ---- getters (computed) ----
  // e.g. const hasLocations = computed(() => locations.value.length > 0)

  // ---- actions ----
  async function addLocation(loc: Location) {
    if (forecasts.value[loc.id]) return          // dedupe
    locations.value.push(loc)
    await refreshLocation(loc.id)
  }

  async function refreshLocation(id: string) {
    const loc = locations.value.find(l => l.id === id)
    if (!loc) return
    loadingIds.value.add(id)
    error.value = null
    try {
      forecasts.value[id] = await getForecast(loc)
    } catch (e) {
      error.value = `Failed to load ${loc.name}`
    } finally {
      loadingIds.value.delete(id)
    }
  }

  function removeLocation(id: string) {
    locations.value = locations.value.filter(l => l.id !== id)
    delete forecasts.value[id]
  }

  async function refreshAll() {
    await Promise.all(locations.value.map(l => refreshLocation(l.id)))
  }

  return { locations, forecasts, loadingIds, error,
           addLocation, refreshLocation, removeLocation, refreshAll }
})
```

### Why the store owns the API calls, not the components

- **Single source of truth.** Every card reads from the same `forecasts` map. No duplicated fetching.
- **Testability.** The store's logic can be tested without mounting components.
- **Reactivity for free.** Assigning `forecasts.value[id] = ...` notifies every component reading it.

> ⚠️ Reactivity gotcha for later: when you need Vue to react to *adding a new key* on an object, assign a
> new value (as above) rather than mutating deeply. With `ref<Record<...>>`, `forecasts.value[id] = x`
> works because you're reading `.value`. Just be aware object/array reactivity has edge cases — we'll hit
> one and learn it.

## Auto-refresh strategy

- A timer (`setInterval`) calls `refreshAll()` every N minutes (default 10 — weather doesn't change fast,
  and it's polite to the free API).
- The timer is set up in `App.vue`'s `onMounted` and **cleared in `onUnmounted`**. Forgetting cleanup is
  the #1 beginner memory-leak bug — we'll extract it into a `useAutoRefresh` composable (a reusable
  function that encapsulates the setup+teardown) as a deliberate lesson.
- Each `Forecast` carries `fetchedAt`, so each card can show "updated 3 min ago" reactively.

## Settings store (stretch — `src/stores/useSettingsStore.ts`)

A second, tiny store for `units` (`"metric" | "imperial"`) and `theme`. Demonstrates **cross-store
reactivity**: when units change, the weather store's fetches use the new unit params, or components
re-derive displayed values. This is the payoff of centralized state — one toggle, whole app reacts.
