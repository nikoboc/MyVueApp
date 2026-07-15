/**
 * Domain models for weather data. These are OUR shapes — the service layer maps
 * Open-Meteo's raw JSON into these, so the rest of the app never depends on the
 * API's field names (see docs/05 §5). Plain TypeScript, zero Vue.
 */

/** A place the user searched for and added to the dashboard. */
export interface Location {
  /** Stable unique key ("lat,lon"), suitable for a `v-for` `:key`. */
  readonly id: string
  readonly name: string
  readonly country: string
  readonly latitude: number
  readonly longitude: number
}

/** Current conditions at a location, normalized from the API. */
export interface CurrentWeather {
  readonly temperature: number
  readonly humidity: number
  readonly windSpeed: number
  /** WMO weather code; mapped to a label/icon for display later. */
  readonly weatherCode: number
  /** ISO timestamp reported by the API. */
  readonly time: string
}

/** Hourly temperature series; `times[i]` pairs with `temperatures[i]`. */
export interface HourlySeries {
  readonly times: readonly string[]
  readonly temperatures: readonly number[]
}

/** Daily forecast series; all arrays are parallel by day index. */
export interface DailySeries {
  readonly dates: readonly string[]
  readonly tempMax: readonly number[]
  readonly tempMin: readonly number[]
  readonly weatherCodes: readonly number[]
}

/** Everything we hold for one location's forecast. */
export interface Forecast {
  readonly current: CurrentWeather
  readonly hourly: HourlySeries
  readonly daily: DailySeries
  /** `Date.now()` when this forecast was fetched; drives "last updated". */
  readonly fetchedAt: number
}
