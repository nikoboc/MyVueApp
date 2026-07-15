import type {
  CurrentWeather,
  DailySeries,
  Forecast,
  HourlySeries,
  Location,
} from '@/types/weather'

/**
 * Open-Meteo client. Plain TypeScript with no Vue — it maps the API's raw
 * wire shapes (snake_case DTOs) into our domain types so the rest of the app
 * never sees Open-Meteo's field names (anti-corruption layer, docs/05 §5).
 *
 * No API key required; the endpoints are CORS-enabled. Docs: https://open-meteo.com/en/docs
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** How many days of daily forecast to request. */
const FORECAST_DAYS = 7

/** How many geocoding matches to request per query. */
const GEOCODING_RESULT_COUNT = 5

// --- wire DTOs: Open-Meteo's raw shapes, internal to this module ---

interface GeocodingResponse {
  readonly results?: readonly GeocodingResult[]
}

interface GeocodingResult {
  readonly id: number
  readonly name: string
  readonly latitude: number
  readonly longitude: number
  readonly country?: string
  readonly admin1?: string
}

interface ForecastResponse {
  readonly current: {
    readonly time: string
    readonly temperature_2m: number
    readonly relative_humidity_2m: number
    readonly wind_speed_10m: number
    readonly weather_code: number
  }
  readonly hourly: {
    readonly time: readonly string[]
    readonly temperature_2m: readonly number[]
  }
  readonly daily: {
    readonly time: readonly string[]
    readonly temperature_2m_max: readonly number[]
    readonly temperature_2m_min: readonly number[]
    readonly weather_code: readonly number[]
  }
}

/**
 * Fetches JSON from a URL and asserts it matches the expected wire shape.
 *
 * @param url - the fully-built request URL
 * @returns the parsed response body, typed as `T`
 * @throws if the network request fails or the server returns a non-2xx status
 */
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status} ${res.statusText})`)
  }
  // Boundary assertion: external JSON is untyped. We trust Open-Meteo's
  // documented shape here rather than validating field-by-field (docs/05 §6).
  return (await res.json()) as T
}

/**
 * Searches for locations matching a free-text city name.
 *
 * @param query - the text to search for, e.g. "Berlin"
 * @returns matching locations, or an empty array when there are none
 * @throws if the geocoding request fails
 */
export async function geocode(query: string): Promise<Location[]> {
  const trimmed = query.trim()
  if (trimmed.length < 1) {
    return []
  }

  const url = new URL(GEOCODING_URL)
  url.searchParams.set('name', trimmed)
  url.searchParams.set('count', String(GEOCODING_RESULT_COUNT))
  url.searchParams.set('language', 'en')
  url.searchParams.set('format', 'json')

  const data = await fetchJson<GeocodingResponse>(url.toString())

  // Open-Meteo omits `results` entirely when nothing matches (docs/03) —
  // default to [] so callers always get an array.
  return (data.results ?? []).map(toLocation)
}

/**
 * Fetches and normalizes the current, hourly, and daily forecast for a location.
 *
 * @param loc - the geocoded location to fetch weather for
 * @returns the mapped domain forecast
 * @throws if the forecast request fails
 */
export async function getForecast(loc: Location): Promise<Forecast> {
  const url = new URL(FORECAST_URL)
  url.searchParams.set('latitude', String(loc.latitude))
  url.searchParams.set('longitude', String(loc.longitude))
  url.searchParams.set('current', 'temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code')
  url.searchParams.set('hourly', 'temperature_2m')
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weather_code')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', String(FORECAST_DAYS))

  const data = await fetchJson<ForecastResponse>(url.toString())

  return {
    current: toCurrentWeather(data.current),
    hourly: toHourlySeries(data.hourly),
    daily: toDailySeries(data.daily),
    fetchedAt: Date.now(),
  }
}

// --- mappers: wire DTO -> domain (the anti-corruption layer) ---

/** Maps a geocoding result to a domain {@link Location}. */
function toLocation(result: GeocodingResult): Location {
  return {
    // Coordinates form a stable, unique key even when city names collide.
    id: `${result.latitude},${result.longitude}`,
    name: result.name,
    country: result.country ?? 'Unknown',
    latitude: result.latitude,
    longitude: result.longitude,
  }
}

/** Maps the current-weather block to domain {@link CurrentWeather}. */
function toCurrentWeather(current: ForecastResponse['current']): CurrentWeather {
  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    time: current.time,
  }
}

/** Maps the hourly block to domain {@link HourlySeries}. */
function toHourlySeries(hourly: ForecastResponse['hourly']): HourlySeries {
  return {
    times: [...hourly.time],
    temperatures: [...hourly.temperature_2m],
  }
}

/** Maps the daily block to domain {@link DailySeries}. */
function toDailySeries(daily: ForecastResponse['daily']): DailySeries {
  return {
    dates: [...daily.time],
    tempMax: [...daily.temperature_2m_max],
    tempMin: [...daily.temperature_2m_min],
    weatherCodes: [...daily.weather_code],
  }
}
