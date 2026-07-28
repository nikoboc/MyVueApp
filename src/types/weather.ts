/**
 * 天気データのドメインモデル。本アプリケーション固有の型であり、Open-Meteo の
 * 生の JSON はサービス層でこの形式へ変換される。そのため他の層が API の
 * フィールド名に依存することはない（docs/05 §5）。Vue を含まない純粋な TypeScript。
 */

/** ユーザーが検索してダッシュボードに追加した地点。 */
export interface Location {
  /** 一意で安定したキー（"緯度,経度"）。`v-for` の `:key` にそのまま使用できる。 */
  readonly id: string
  readonly name: string
  readonly country: string
  readonly latitude: number
  readonly longitude: number
}

/** ある地点の現在の気象状況。API のレスポンスを正規化したもの。 */
export interface CurrentWeather {
  readonly temperature: number
  readonly humidity: number
  readonly windSpeed: number
  /** WMO 天気コード。表示時にラベルとアイコンへ変換する。 */
  readonly weatherCode: number
  /** API が返す ISO 形式のタイムスタンプ。 */
  readonly time: string
}

/** 時間別の気温データ。`times[i]` と `temperatures[i]` が対になる。 */
export interface HourlySeries {
  readonly times: readonly string[]
  readonly temperatures: readonly number[]
}

/** 日別の予報データ。どの配列も、同じ添字が同じ日を指す。 */
export interface DailySeries {
  readonly dates: readonly string[]
  readonly tempMax: readonly number[]
  readonly tempMin: readonly number[]
  readonly weatherCodes: readonly number[]
}

/** 1 地点分の予報として保持するデータ一式。 */
export interface Forecast {
  readonly current: CurrentWeather
  readonly hourly: HourlySeries
  readonly daily: DailySeries
  /** この予報を取得した時刻（`Date.now()`）。最終更新の表示に用いる。 */
  readonly fetchedAt: number
}
