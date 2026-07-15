# WeatherBoard — Design Docs

A real-time weather dashboard built with **Vue 3 + TypeScript + Pinia**, backed by the free
[Open-Meteo](https://open-meteo.com/) API. This is a learning project: the goal is to internalize
Vue's reactive, declarative model — not to ship a product.

## Documents

| Doc | What it covers |
|-----|----------------|
| [01 — Overview](./01-overview.md) | Vision, features (MVP + stretch), scope and non-goals |
| [02 — Architecture](./02-architecture.md) | Tech stack, project layout, component tree, data flow |
| [03 — State & Data](./03-state-and-data.md) | Pinia store design, typed models, Open-Meteo integration |
| [04 — Roadmap](./04-roadmap.md) | Phased build plan, each phase mapped to a Vue concept |
| [05 — TypeScript Conventions](./05-typescript-conventions.md) | TS coding rules for this project, framed for a Java dev |

## The one mental shift

Coming from Java/servlets, the instinct is *imperative*: "when the user does X, go find the DOM node
and update it." Vue is *declarative*: **the view is a pure function of state.** You change state; Vue
recomputes what the DOM should look like and patches it for you. Every design decision in these docs
serves that model — which is why state (the Pinia store) is the center of gravity, not the components.

## Decisions locked in

- **Framework:** Vue 3, Composition API, `<script setup>` (the modern default — ignore Options API tutorials)
- **Language:** TypeScript
- **Build tool:** Vite
- **State:** Pinia
- **Charts:** Chart.js via `vue-chartjs`
- **Data source:** Open-Meteo (no API key required)
