# CLAUDE.md

Project conventions for **WeatherBoard** — a real-time weather dashboard built as a Vue learning
project. Full design lives in [`docs/`](./docs/README.md); read `docs/03-state-and-data.md` before
touching the store.

## Mandatory for AI assistants

The rules in this file and in [`docs/05-typescript-conventions.md`](./docs/05-typescript-conventions.md)
are **mandatory, not advisory** — AI assistants MUST follow them when writing or changing code.

**Before proposing or making any commit**, review every file you touched against these conventions and
the architecture rules below, and fix all violations first. Never commit code that breaks the
conventions. When you self-review, state briefly which rules you checked.

## Context

- **Owner is a backend Java engineer (7 yrs) learning Vue.** Favor explanations that bridge from
  Java/OOP/backend concepts. When introducing a new Vue idea, name it and say what it maps to.
- This is a **learning project**: prefer clear, idiomatic, teachable code over clever code. Explain the
  "why," not just the "what."

## Tech stack (locked)

- **Vue 3** — Composition API with `<script setup>` **only**. Never Options API.
- **TypeScript** — strict. Type API boundaries and store state explicitly. Follow
  [`docs/05-typescript-conventions.md`](./docs/05-typescript-conventions.md).
- **Pinia** — setup-style stores (`defineStore("x", () => { ... })`).
- **Vite** — build/dev tooling.
- **Chart.js** via `vue-chartjs` — charts.
- **Open-Meteo** — data source, called directly from the browser. No API key, no custom backend.

## Architecture rules (non-negotiable — these are the "criteria")

1. **Store is the single source of truth.** Global state lives in Pinia. Components read from the store
   and trigger actions; they do not hold app state locally beyond ephemeral UI state.
2. **Props down, events up.** Components receive data via `props` and communicate upward via `emit`.
3. **Components never call the API directly.** They call store actions. The store calls the service.
4. **Keep Vue out of the service layer.** `src/services/` and `src/types/` are plain TypeScript with
   zero Vue imports — unit-testable and framework-agnostic (the anti-corruption layer).
5. **Map at the boundary.** The service maps Open-Meteo JSON into our own domain types; the rest of the
   app never sees raw API field names.
6. **Clean up side effects.** Any `setInterval`/listener set up in `onMounted` must be torn down in
   `onUnmounted` (prefer a composable).

## Naming & structure

- Components: `PascalCase.vue`. Reusable primitives get a `Base` prefix (`BaseSpinner.vue`).
- Stores: `useXStore.ts`, exported as `useXStore`.
- Composables: `useX.ts` in `src/composables/`.
- Follow the project layout in `docs/02-architecture.md`.

## Workflow

- **Build in the phases defined in `docs/04-roadmap.md`.** One concept per increment; don't jump ahead.
- **Commit per phase**, Conventional Commits style (`feat:`, `docs:`, `chore:`, `refactor:`).
  `.planning/`-style noise doesn't apply here — commits are small and readable on purpose.
- Only commit/push when explicitly asked.

## Commands

_To be filled in after Phase 0 scaffolding. Expected:_

- `npm run dev` — start the Vite dev server
- `npm run build` — type-check + production build
- `npm run preview` — preview the production build
