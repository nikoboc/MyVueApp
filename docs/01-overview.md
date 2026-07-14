# 01 — Overview

## Vision

A single-page dashboard that shows **live weather for one or more locations**. You search for a city,
it appears as a card with current conditions, and charts show the hourly and daily forecast. The data
refreshes on an interval so the dashboard feels "live."

## Primary user story

> As a user, I type a city name, and I immediately see its current weather plus a temperature chart for
> the next 24 hours and the next 7 days. I can add several cities and watch them update automatically.

## Features

### MVP (build this first)

1. **Location search** — type a city, pick from matches (Open-Meteo geocoding), add it to the dashboard.
2. **Current conditions card** — temperature, humidity, wind, a weather-code → icon/label mapping.
3. **Hourly temperature chart** — next 24h line chart (Chart.js).
4. **Multiple locations** — add/remove cities; each renders its own card.
5. **Auto-refresh** — poll every N minutes; a visible "last updated" timestamp.
6. **Loading & error states** — every async fetch shows a spinner and handles failure gracefully.

### Stretch (once the MVP clicks)

- **7-day daily chart** — high/low temperature per day.
- **Unit toggle** — °C/°F, km/h / mph — a great exercise in a global setting flowing through the store.
- **Persistence** — save the user's city list to `localStorage` and restore on reload.
- **Favorite / reorder** — drag to reorder cards.
- **Dark mode** — a reactive theme toggle.

## Scope & non-goals

**In scope:** frontend only, client-side state, one third-party API, charts, polling.

**Explicitly NOT in scope (keeps the learning focused):**

- No custom backend. Open-Meteo is called directly from the browser (it allows CORS and needs no key).
- No auth / user accounts.
- No database. Persistence, if any, is `localStorage`.
- No true WebSocket streaming — "real-time" here means interval polling, which is what free weather
  APIs support anyway.

## Why this is a good Vue teacher

| Feature | Vue concept it forces you to learn |
|---------|-------------------------------------|
| Search box → results | Two-way binding (`v-model`), event handling |
| Current conditions card | Props, computed properties, conditional rendering (`v-if`) |
| City list | List rendering (`v-for`), keys, component composition |
| Fetch on add | Lifecycle (`onMounted`), async actions |
| Auto-refresh | `watch`, timers, cleanup on unmount |
| Shared city list + units | **Pinia** — global reactive state across components |
| Charts | Passing reactive data into a third-party library and reacting to changes |
