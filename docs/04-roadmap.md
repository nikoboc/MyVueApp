# 04 — Roadmap

Each phase is a small, runnable increment that teaches **one** Vue concept. Don't skip ahead — the
value is in feeling each concept land before adding the next.

## Phase 0 — Scaffold & "hello reactive"

**Goal:** a running Vite + Vue 3 + TS app with Pinia installed.

- `npm create vite@latest` → Vue + TS template.
- Install `pinia`, `chart.js`, `vue-chartjs`.
- Wire Pinia in `main.ts`.
- Throwaway counter in `App.vue` to *see* reactivity: a `ref`, a button, a `computed`.

**Learn:** project structure, `<script setup>`, `ref`, `computed`, `v-on`/`@click`, `{{ }}` interpolation.
**Done when:** `npm run dev` shows a counter that updates live.

## Phase 1 — Types & service layer (no UI)

**Goal:** the plumbing, unit-testable, zero Vue.

- Write `types/weather.ts`.
- Write `services/weatherApi.ts` (`geocode`, `getForecast`) with DTO→domain mapping.
- Verify by calling them from a scratch script or a temporary button that `console.log`s results.

**Learn:** TypeScript interfaces, `fetch`, async/await, mapping API JSON to domain types.
**Done when:** you can log real Berlin weather to the console.

## Phase 2 — The Pinia store

**Goal:** state + actions wired to the service.

- Build `useWeatherStore` per doc 03.
- No polished UI yet — a bare input + button that calls `addLocation`, and a `<pre>` dumping the store
  state so you can watch it change.

**Learn:** `defineStore`, state/getters/actions, how a component reads a store, reactivity across the boundary.
**Done when:** typing a city and clicking "add" fills the store, visibly.

## Phase 3 — Components: search + card

**Goal:** real UI, props down / events up.

- `LocationSearch.vue` — `v-model` on the input, geocoding dropdown, emits/calls `addLocation`.
- `LocationCard.vue` + `CurrentConditions.vue` — receive a location via **props**, read its forecast from
  the store, render current conditions with the weather-code lookup.
- `v-for` over `store.locations` in `App.vue`, with `:key`.
- `BaseSpinner.vue` + loading/error states.

**Learn:** `v-model`, props, `defineProps`, `emit`, `v-for` + keys, `v-if`/`v-else`, component composition.
**Done when:** search a city → a card appears with live current conditions.

## Phase 4 — Charts

**Goal:** reactive data into a third-party lib.

- `HourlyChart.vue` — a `vue-chartjs` `<Line>` fed the `HourlySeries` from the store.
- Make it **react**: when the forecast refreshes, the chart updates (watch the prop / pass reactive data).

**Learn:** integrating non-Vue libraries, passing reactive data as props, reacting to prop changes.
**Done when:** each card shows a 24h temperature line that updates on refresh.

## Phase 5 — Auto-refresh & polish

**Goal:** make it feel "live," learn lifecycle + cleanup.

- Interval polling via a `useAutoRefresh` composable; set up in `onMounted`, tear down in `onUnmounted`.
- "Updated N min ago" per card (reactive, derived from `fetchedAt`).
- Remove-location button; empty state.

**Learn:** `onMounted`/`onUnmounted`, `watch`, composables (reusable stateful logic), timer cleanup.
**Done when:** cards refresh on their own and show a live "last updated"; no console warnings on add/remove.

## Phase 6 — Stretch goals (pick what interests you)

- **7-day daily chart** (`DailyChart.vue`) — more Chart.js reps.
- **Unit toggle** via `useSettingsStore` — cross-store reactivity.
- **`localStorage` persistence** — restore city list on reload (a `watch` that saves, load on init).
- **Dark mode** — reactive theming.
- **Drag-to-reorder** cards.
- **Tests** — Vitest on the service layer and store (plays to your testing instincts).

---

## Suggested working rhythm

1. Read the relevant section of docs 02–03 for the phase.
2. Build the smallest version that runs.
3. Break it on purpose once (e.g., mutate state the "Java way" and watch it *not* update) — the failures
   teach reactivity faster than the successes.
4. Commit per phase. Small commits = a readable learning history.

When you're ready, say the word and I'll scaffold **Phase 0** and we'll get a reactive counter on screen.
