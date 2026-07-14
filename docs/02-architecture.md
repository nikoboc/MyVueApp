# 02 — Architecture

## Tech stack

| Layer | Choice | Java-world analogy |
|-------|--------|--------------------|
| Build / dev server | **Vite** | Maven/Gradle + hot-reload dev server, but instant |
| Language | **TypeScript** | Java's static typing — your safety net |
| UI framework | **Vue 3** (Composition API, `<script setup>`) | A view + reactivity engine |
| State | **Pinia** | A set of `@Service`/singleton beans holding app state |
| HTTP | **`fetch`** (wrapped in a small service) | `RestTemplate` / `HttpClient` |
| Charts | **Chart.js** via `vue-chartjs` | A reporting/charting library |

We keep dependencies minimal on purpose. No UI component library, no router yet (single page). Add them
later if a feature needs them.

## Project layout

```
src/
  main.ts                  # app entry: create app, install Pinia, mount
  App.vue                  # root component; overall layout
  assets/                  # css, static
  types/
    weather.ts             # TypeScript interfaces for API data & domain models
  services/
    weatherApi.ts          # Open-Meteo calls (geocoding + forecast). No Vue in here.
    weatherCodes.ts        # WMO weather-code → label/icon lookup
  stores/
    useWeatherStore.ts     # Pinia store: locations, forecasts, actions, refresh
    useSettingsStore.ts    # Pinia store: units, theme (stretch)
  components/
    LocationSearch.vue     # search input + results dropdown
    LocationCard.vue       # one city: current conditions + its charts
    CurrentConditions.vue  # temp/humidity/wind readout
    HourlyChart.vue        # 24h line chart
    DailyChart.vue         # 7-day chart (stretch)
    BaseSpinner.vue        # reusable loading indicator
  composables/
    useAutoRefresh.ts      # reusable interval logic with cleanup (stretch)
```

**Design principle — keep Vue out of the service layer.** `services/` and `types/` are plain TypeScript
with zero Vue imports. They could be unit-tested or reused in any project. Vue's reactivity lives in the
stores and components. This separation will feel familiar: it's the same instinct as keeping your
domain/service layer independent of the web framework.

## Component tree

```
App.vue
├── LocationSearch.vue        (adds a city to the store)
└── v-for over store.locations:
    └── LocationCard.vue      (props: location)
        ├── CurrentConditions.vue   (props: current data)
        ├── HourlyChart.vue         (props: hourly series)
        └── DailyChart.vue          (props: daily series)   ← stretch
```

Components are **dumb / presentational** wherever possible: they receive data via **props** and emit
**events** upward. They do not call the API directly — they ask the store. This is the classic
"props down, events up" rule and it's what keeps a Vue app debuggable.

## Data flow

The core loop — read this until it's second nature:

```
                    ┌─────────────────────────────┐
   user types city  │        LocationSearch        │
  ─────────────────▶│  calls store.addLocation()   │
                    └───────────────┬──────────────┘
                                    │ action
                                    ▼
        ┌───────────────────────────────────────────────┐
        │              useWeatherStore (Pinia)           │
        │  state: locations[], forecasts{}, loading, err │
        │  action addLocation():                         │
        │     → weatherApi.geocode()                     │
        │     → weatherApi.getForecast()                 │
        │     → mutate state (reactive!)                 │
        └───────────────┬───────────────────────────────┘
                        │ state changes are reactive
                        ▼
        ┌───────────────────────────────────────────────┐
        │  Components read store state and RE-RENDER      │
        │  automatically. You never touch the DOM.        │
        └───────────────────────────────────────────────┘
```

The key idea: **components never mutate state directly and never call the API directly.** They trigger
**actions**; actions do the async work and mutate state; the reactive system repaints. One direction,
always. When something looks wrong on screen, you inspect the store — not the DOM.

## Reactivity in one paragraph (the Java-dev version)

In Java, if you have `int temp = 20;` and later render it, changing `temp` does nothing to the UI — you'd
re-render manually. Vue wraps your state in reactive proxies. When you read `store.temp` inside a
component's template, Vue records "this component depends on `temp`." When you later assign a new value,
Vue knows exactly which components to re-run. `computed(() => a + b)` is a memoized derived value —
think a getter that caches until its inputs change. `watch(source, cb)` is an observer/listener that
fires a side effect when a value changes (e.g., "when the city changes, refetch"). That's the whole model.
