# 03 — 状態とデータ

本ドキュメントが扱う範囲がアプリケーションの中核である。ストアとデータモデルが確定すれば、
コンポーネントの実装はほぼ自動的に決まる。

## 型付きのドメインモデル（`src/types/weather.ts`）

最初に構造を定義する。Java エンジニアにとっては馴染みのある作業であり、ここを固めることで後続の
実装が容易になる。

```ts
// ユーザーが検索して追加した地点
export interface Location {
  id: string          // v-for 用の一意なキー。`${latitude},${longitude}` の形式とする
  name: string        // "東京都"
  country: string     // "日本"
  latitude: number
  longitude: number
}

// 現在の気象状況。API のレスポンスを正規化したもの
export interface CurrentWeather {
  temperature: number
  humidity: number
  windSpeed: number
  weatherCode: number // WMO コード。weatherCodes.ts でラベルとアイコンに変換する
  time: string        // API が返す ISO 形式のタイムスタンプ
}

// 添字が対応する配列（Chart.js に適した形式）。times[i] と temperatures[i] が対応する
export interface HourlySeries {
  times: string[]
  temperatures: number[]
}

export interface DailySeries {
  dates: string[]
  tempMax: number[]
  tempMin: number[]
  weatherCodes: number[]
}

// 1 地点について保持するデータ一式
export interface Forecast {
  current: CurrentWeather
  hourly: HourlySeries
  daily: DailySeries
  fetchedAt: number   // 保存時点の Date.now()。最終更新の表示に用いる
}
```

## Open-Meteo API（`src/services/weatherApi.ts`）

使用するエンドポイントは 2 つである。API キーは不要で、CORS にも対応している。
公式ドキュメント: https://open-meteo.com/en/docs

### 1. ジオコーディング（都市名 → 座標）

```
GET https://geocoding-api.open-meteo.com/v1/search?name=Tokyo&count=5&language=ja&format=json
```

レスポンス（抜粋）:

```json
{
  "results": [
    { "id": 1850147, "name": "東京都", "latitude": 35.6895, "longitude": 139.69171,
      "country": "日本", "admin1": "東京都" }
  ]
}
```

> ⚠️ `language=ja` が影響するのは**返却されるラベル**のみであり、**検索クエリ**には影響しない。
> Open-Meteo の検索インデックスは日本の都市を漢字およびひらがなで検索できないため、`name=東京` は
> 0 件となる。ローマ字で `name=Tokyo` とすれば「東京都」が返る。外国の都市はカタカナでも検索できる
> （`name=ベルリン` → 「ベルリン」）が、日本の都市は検索できない。この差異があるため、検索欄では
> ローマ字入力を案内している。

> 該当が 1 件も無い場合、API は `results` キー自体を返さない（空配列ではなく、キーが存在しない）。
> 呼び出し側で対応する必要がある（`data.results ?? []`）。

### 2. 予報（座標 → 天気）

```
GET https://api.open-meteo.com/v1/forecast
    ?latitude=35.6895&longitude=139.69171
    &current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code
    &hourly=temperature_2m
    &daily=temperature_2m_max,temperature_2m_min,weather_code
    &timezone=auto
    &forecast_days=7
```

レスポンス（抜粋）:

```json
{
  "current": {
    "time": "2026-07-14T18:00",
    "temperature_2m": 21.3,
    "relative_humidity_2m": 55,
    "wind_speed_10m": 12.4,
    "weather_code": 3
  },
  "hourly": {
    "time": ["2026-07-14T00:00", "..."],
    "temperature_2m": [18.1, 17.6, "..."]
  },
  "daily": {
    "time": ["2026-07-14", "..."],
    "temperature_2m_max": [24.0, "..."],
    "temperature_2m_min": [14.0, "..."],
    "weather_code": [3, "..."]
  }
}
```

### サービス層の役割

サービス層が返すのは生の API JSON ではなく、本アプリケーションのドメイン型である。変換（腐敗防止層）を
ここに配置することで、他の層が Open-Meteo のフィールド名に依存しなくなる。Java において DTO を
ドメインオブジェクトへ詰め替えるのと同じ理由による。

```ts
export async function geocode(query: string): Promise<Location[]> { /* 取得して変換する */ }
export async function getForecast(loc: Location): Promise<Forecast> { /* 取得して変換する */ }
```

単位については、ストレッチ課題の単位切り替えにおいて、リクエストパラメーターに
`temperature_unit=fahrenheit` や `wind_speed_unit=mph` を追加できる。

### WMO 天気コード（`src/services/weatherCodes.ts`）

Open-Meteo は天気を [WMO コード](https://open-meteo.com/en/docs)で返す（0 が快晴、1〜3 が晴れから
くもり、45/48 が霧、51〜67 が雨、71〜77 が雪、80〜82 がにわか雨、95〜99 が雷雨）。変換用のマップを
用意する。

```ts
export const weatherCodes: Record<number, { label: string; icon: string }> = {
  0: { label: "快晴", icon: "☀️" },
  3: { label: "くもり", icon: "☁️" },
  // ...以下を埋める
}
```

## Pinia ストア（`src/stores/useWeatherStore.ts`）

グローバルな状態を配置する場所が Pinia である。1 つのストアは、状態を保持しメソッドを公開する
シングルトンのサービス Bean に相当する。コンポーネントはストアを取得し、そのアクションを呼び出す。

### 構成

setup 形式の Pinia は 3 つの要素から構成される。

| 要素 | 実体 | Java における対応物 |
|------|----|--------------|
| **state** | リアクティブなフィールド（`ref`） | Bean のインスタンスフィールド |
| **getters** | キャッシュされる導出値（`computed`） | キャッシュ付きのゲッター |
| **actions** | メソッド。非同期も可能で、状態を変更する | Bean のサービスメソッド |

### 設計

```ts
import { defineStore } from "pinia"
import { ref } from "vue"
import type { Location, Forecast } from "@/types/weather"
import { geocode, getForecast } from "@/services/weatherApi"

export const useWeatherStore = defineStore("weather", () => {
  // ---- state ----
  const locations = ref<Location[]>([])
  const forecasts = ref<Record<string, Forecast>>({})   // location.id をキーとする
  const loadingIds = ref<Set<string>>(new Set())         // 取得中のカード
  const error = ref<string | null>(null)

  // ---- getters (computed) ----
  // 例: const hasLocations = computed(() => locations.value.length > 0)

  // ---- actions ----
  async function addLocation(loc: Location) {
    if (forecasts.value[loc.id]) return          // 重複を防ぐ
    locations.value.push(loc)
    await refreshLocation(loc.id)
  }

  async function refreshLocation(id: string) {
    const loc = locations.value.find(l => l.id === id)
    if (!loc) return
    loadingIds.value.add(id)
    error.value = null
    try {
      forecasts.value[id] = await getForecast(loc)
    } catch (e) {
      error.value = `${loc.name}の読み込みに失敗しました`
    } finally {
      loadingIds.value.delete(id)
    }
  }

  function removeLocation(id: string) {
    locations.value = locations.value.filter(l => l.id !== id)
    delete forecasts.value[id]
  }

  async function refreshAll() {
    await Promise.all(locations.value.map(l => refreshLocation(l.id)))
  }

  return { locations, forecasts, loadingIds, error,
           addLocation, refreshLocation, removeLocation, refreshAll }
})
```

> 実装上の補足: 上記の重複チェックは `forecasts` を参照しているが、実際の
> `src/stores/useWeatherStore.ts` では `locations` を参照するよう修正している。取得に失敗した地点は
> `forecasts` にエントリーを持たないため、`forecasts` を基準にすると同一の都市を二重に追加できて
> しまう。理由はコード側のコメントに記載している。

### API 呼び出しをコンポーネントではなくストアに配置する理由

- **状態が一箇所に集約される。** すべてのカードが同一の `forecasts` を参照するため、取得処理が重複しない。
- **テストが容易になる。** ストアのロジックは、コンポーネントをマウントせずにテストできる。
- **リアクティビティが自動的に働く。** `forecasts.value[id] = ...` の代入により、参照している
  すべてのコンポーネントへ変更が伝播する。

> ⚠️ 注意点として、オブジェクトへの新しいキーの追加を Vue に認識させる場合は、深い階層を変更するのでは
> なく、上記のように値を代入する。`ref<Record<...>>` において `forecasts.value[id] = x` が機能するのは、
> `.value` を経由して参照しているためである。オブジェクトおよび配列のリアクティビティには例外的な
> 挙動も存在する。

## 自動更新の方針

- `setInterval` により N 分ごとに `refreshAll()` を呼び出す（既定は 10 分。天気の変化は緩やかであり、
  無料 API への負荷も抑えられる）。
- タイマーは `App.vue` の `onMounted` で開始し、**`onUnmounted` で破棄する**。クリーンアップの漏れは
  メモリリークにつながるため、これを学習項目として `useAutoRefresh` コンポーザブル（開始と破棄をまとめた
  再利用可能な関数）へ切り出す。
- 各 `Forecast` が `fetchedAt` を保持するため、カードごとに「3 分前に更新」といった表示が可能となる。

## 設定ストア（ストレッチ — `src/stores/useSettingsStore.ts`）

`units`（`"metric" | "imperial"`）と `theme` を保持する 2 つ目のストアである。ストア間の
リアクティビティの例となる。単位が変更されると、天気ストアが新しい単位で再取得するか、コンポーネントが
表示値を再計算する。切り替え 1 つでアプリケーション全体が反応する点が、状態を集約したことの利点である。
