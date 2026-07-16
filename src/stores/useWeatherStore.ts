import { defineStore } from 'pinia'
import { ref } from 'vue'

import { geocode, getForecast } from '@/services/weatherApi'
import type { Forecast, Location } from '@/types/weather'

/**
 * Central store for the dashboard: the tracked locations and their forecasts.
 * This is the single source of truth — components read from it and call its
 * actions; only the store talks to the weather service (CLAUDE.md architecture
 * rules). See docs/03-state-and-data.md.
 */
export const useWeatherStore = defineStore('weather', () => {
  // --- state ---

  /** Locations the user has added, in display order. */
  const locations = ref<Location[]>([])

  /** Forecasts keyed by `Location.id`. */
  const forecasts = ref<Record<string, Forecast>>({})

  /** Ids of locations whose forecast is currently being fetched. */
  const loadingIds = ref<Set<string>>(new Set())

  /** Last error message, or `null` when the last action succeeded. */
  const error = ref<string | null>(null)

  // --- actions ---

  /**
   * Searches for locations matching a city name. Beyond clearing/setting
   * `error` it does not mutate state — it returns candidates for the caller to
   * choose from (this keeps API access behind the store, CLAUDE.md rule 3).
   *
   * @param query - free-text city name
   * @returns matching locations (empty when none, or on failure)
   */
  async function searchLocations(query: string): Promise<Location[]> {
    error.value = null
    try {
      return await geocode(query)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Search failed'
      return []
    }
  }

  /**
   * Adds a location and fetches its forecast. No-op if it is already tracked.
   *
   * @param loc - the location to add
   */
  async function addLocation(loc: Location): Promise<void> {
    // Dedupe against `locations`, not `forecasts`: a location whose fetch failed
    // (or is still in flight) has no forecast entry yet, so keying the guard off
    // `forecasts` would let the same city be added twice — duplicate `v-for`
    // keys and a doubled card. `locations` is the list the UI renders, so it is
    // the list the guard must protect.
    if (locations.value.some((l) => l.id === loc.id)) {
      return
    }
    locations.value.push(loc)
    await refreshLocation(loc.id)
  }

  /**
   * Re-fetches the forecast for one tracked location.
   *
   * @param id - the `Location.id` to refresh
   */
  async function refreshLocation(id: string): Promise<void> {
    const loc = locations.value.find((l) => l.id === id)
    if (!loc) {
      return
    }
    loadingIds.value.add(id)
    error.value = null
    try {
      forecasts.value[id] = await getForecast(loc)
    } catch (e) {
      error.value = e instanceof Error ? e.message : `Failed to load ${loc.name}`
    } finally {
      loadingIds.value.delete(id)
    }
  }

  /**
   * Removes a location and its forecast from the dashboard.
   *
   * @param id - the `Location.id` to remove
   */
  function removeLocation(id: string): void {
    locations.value = locations.value.filter((l) => l.id !== id)
    delete forecasts.value[id]
  }

  /** Re-fetches every tracked location's forecast in parallel. */
  async function refreshAll(): Promise<void> {
    await Promise.all(locations.value.map((l) => refreshLocation(l.id)))
  }

  return {
    locations,
    forecasts,
    loadingIds,
    error,
    searchLocations,
    addLocation,
    refreshLocation,
    removeLocation,
    refreshAll,
  }
})
