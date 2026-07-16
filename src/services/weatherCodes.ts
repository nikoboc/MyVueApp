/**
 * WMO weather-code lookup. Open-Meteo reports conditions as numeric WMO codes
 * (https://open-meteo.com/en/docs); this turns them into something a human can
 * read. Plain TypeScript with zero Vue, like the rest of `services/`.
 */

/** How one weather code is presented in the UI. */
export interface WeatherDescription {
  readonly label: string
  readonly icon: string
}

/** Shown when the API reports a code we have no entry for. */
const UNKNOWN_WEATHER: WeatherDescription = { label: 'Unknown', icon: '❓' }

/**
 * WMO code → label/icon. The codes are sparse and grouped by family (0–3 clear
 * to overcast, 45/48 fog, 51–57 drizzle, 61–67 rain, 71–77 snow, 80–86 showers,
 * 95–99 thunderstorm), which is why this is a keyed map rather than an array.
 */
const WEATHER_CODES: Record<number, WeatherDescription> = {
  0: { label: 'Clear sky', icon: '☀️' },
  1: { label: 'Mainly clear', icon: '🌤️' },
  2: { label: 'Partly cloudy', icon: '⛅' },
  3: { label: 'Overcast', icon: '☁️' },
  45: { label: 'Fog', icon: '🌫️' },
  48: { label: 'Rime fog', icon: '🌫️' },
  51: { label: 'Light drizzle', icon: '🌦️' },
  53: { label: 'Moderate drizzle', icon: '🌦️' },
  55: { label: 'Dense drizzle', icon: '🌦️' },
  56: { label: 'Light freezing drizzle', icon: '🌧️' },
  57: { label: 'Dense freezing drizzle', icon: '🌧️' },
  61: { label: 'Slight rain', icon: '🌧️' },
  63: { label: 'Moderate rain', icon: '🌧️' },
  65: { label: 'Heavy rain', icon: '🌧️' },
  66: { label: 'Light freezing rain', icon: '🌧️' },
  67: { label: 'Heavy freezing rain', icon: '🌧️' },
  71: { label: 'Slight snowfall', icon: '🌨️' },
  73: { label: 'Moderate snowfall', icon: '🌨️' },
  75: { label: 'Heavy snowfall', icon: '❄️' },
  77: { label: 'Snow grains', icon: '🌨️' },
  80: { label: 'Slight rain showers', icon: '🌦️' },
  81: { label: 'Moderate rain showers', icon: '🌦️' },
  82: { label: 'Violent rain showers', icon: '⛈️' },
  85: { label: 'Slight snow showers', icon: '🌨️' },
  86: { label: 'Heavy snow showers', icon: '❄️' },
  95: { label: 'Thunderstorm', icon: '⛈️' },
  96: { label: 'Thunderstorm with slight hail', icon: '⛈️' },
  99: { label: 'Thunderstorm with heavy hail', icon: '⛈️' },
}

/**
 * Describes a WMO weather code for display.
 *
 * @param code - the WMO code reported by the API
 * @returns the matching label and icon, or an "Unknown" fallback
 */
export function describeWeather(code: number): WeatherDescription {
  // `noUncheckedIndexedAccess` (docs/05 §1) types this lookup as
  // `WeatherDescription | undefined`, so the compiler forces the fallback —
  // it isn't just defensive habit. WMO also defines codes we don't map.
  return WEATHER_CODES[code] ?? UNKNOWN_WEATHER
}
