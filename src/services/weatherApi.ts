import type {
  CurrentWeather,
  DailySeries,
  Forecast,
  HourlySeries,
  Location,
} from '@/types/weather'

/**
 * Open-Meteo のクライアント。Vue を含まない純粋な TypeScript である。API が返す
 * snake_case の DTO を、本アプリケーションのドメイン型へ変換する。この層により、
 * 他の層は Open-Meteo のフィールド名に依存しない（腐敗防止層。docs/05 §5）。
 *
 * API キーは不要であり、エンドポイントは CORS に対応している。
 * ドキュメント: https://open-meteo.com/en/docs
 */

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** 何日分の日別予報をリクエストするか。 */
const FORECAST_DAYS = 7

/** 1 回の検索で取得するジオコーディング候補の件数。 */
const GEOCODING_RESULT_COUNT = 5

/**
 * ジオコーディング結果を受け取る言語。地名と国名がこの言語で返る
 * （"Berlin" → "ベルリン"、"Tokyo" → "東京都"）。
 *
 * この指定が影響するのは返却されるラベルのみであり、検索クエリには影響しない。
 * Open-Meteo の検索インデックスは日本の都市を漢字およびひらがなで検索できない
 * ため、`name=東京` は 0 件となる（ローマ字の `name=Tokyo` であれば「東京都」が
 * 返る）。外国の都市はカタカナでも検索できるが、日本の都市は検索できない。
 * この差異があるため、検索欄のプレースホルダーではローマ字入力を案内している。
 */
const GEOCODING_LANGUAGE = 'ja'

// --- ワイヤ DTO: Open-Meteo の生の形。このモジュール内部だけのもの ---

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
 * URL から JSON を取得し、期待する形式であるとみなして返す。
 *
 * @param url - 組み立て済みのリクエスト URL
 * @returns パース済みのレスポンスボディ（`T` として型付け）
 * @throws 通信に失敗した場合、またはサーバーが 2xx 以外を返した場合
 */
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`リクエストに失敗しました（${res.status} ${res.statusText}）`)
  }
  // 境界でのアサーション。外部から取得する JSON には型が無い。ここでは
  // フィールドを 1 つずつ検証せず、Open-Meteo のドキュメントどおりの形式が
  // 返ることを前提としている（docs/05 §6）。
  return (await res.json()) as T
}

/**
 * 都市名（フリーテキスト）に一致する地点を検索する。
 *
 * @param query - 検索する文字列。日本の都市はローマ字で指定する（例：「Tokyo」）。
 *   理由は {@link GEOCODING_LANGUAGE} のコメントを参照
 * @returns 一致した地点の配列。該当なしのときは空配列
 * @throws ジオコーディングのリクエストが失敗した場合
 */
export async function geocode(query: string): Promise<Location[]> {
  const trimmed = query.trim()
  if (trimmed.length < 1) {
    return []
  }

  const url = new URL(GEOCODING_URL)
  url.searchParams.set('name', trimmed)
  url.searchParams.set('count', String(GEOCODING_RESULT_COUNT))
  url.searchParams.set('language', GEOCODING_LANGUAGE)
  url.searchParams.set('format', 'json')

  const data = await fetchJson<GeocodingResponse>(url.toString())

  // 該当が 1 件も無い場合、Open-Meteo は `results` キー自体を返さない
  // （docs/03）。`[]` を既定値とし、呼び出し側が常に配列を受け取れるようにする。
  return (data.results ?? []).map(toLocation)
}

/**
 * 指定した地点の現在・時間別・日別の予報を取得し、ドメイン型へ正規化する。
 *
 * @param loc - ジオコーディング済みの、天気を取得したい地点
 * @returns マッピング後のドメインの予報データ
 * @throws 予報のリクエストが失敗した場合
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

// --- マッパー: ワイヤ DTO -> ドメイン（腐敗防止層の本体） ---

/** ジオコーディング結果をドメインの {@link Location} に変換する。 */
function toLocation(result: GeocodingResult): Location {
  return {
    // 緯度と経度の組を用いることで、同名の都市が存在してもキーが重複しない。
    id: `${result.latitude},${result.longitude}`,
    name: result.name,
    country: result.country ?? '不明',
    latitude: result.latitude,
    longitude: result.longitude,
  }
}

/** 現在の天気ブロックをドメインの {@link CurrentWeather} に変換する。 */
function toCurrentWeather(current: ForecastResponse['current']): CurrentWeather {
  return {
    temperature: current.temperature_2m,
    humidity: current.relative_humidity_2m,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    time: current.time,
  }
}

/** 時間別ブロックをドメインの {@link HourlySeries} に変換する。 */
function toHourlySeries(hourly: ForecastResponse['hourly']): HourlySeries {
  return {
    times: [...hourly.time],
    temperatures: [...hourly.temperature_2m],
  }
}

/** 日別ブロックをドメインの {@link DailySeries} に変換する。 */
function toDailySeries(daily: ForecastResponse['daily']): DailySeries {
  return {
    dates: [...daily.time],
    tempMax: [...daily.temperature_2m_max],
    tempMin: [...daily.temperature_2m_min],
    weatherCodes: [...daily.weather_code],
  }
}
