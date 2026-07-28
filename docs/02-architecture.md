# 02 — アーキテクチャ

## 技術スタック

| レイヤー | 採用技術 | Java における対応物 |
|-------|--------|--------------------|
| ビルド・開発サーバー | **Vite** | Maven/Gradle とホットリロード対応の開発サーバー |
| 言語 | **TypeScript** | Java の静的型付け |
| UI フレームワーク | **Vue 3**（Composition API、`<script setup>`） | ビューとリアクティビティのエンジン |
| 状態管理 | **Pinia** | 状態を保持する `@Service`／シングルトン Bean |
| HTTP | **`fetch`**（サービス層でラップする） | `RestTemplate` / `HttpClient` |
| グラフ | **Chart.js**（`vue-chartjs` 経由） | 帳票・チャート作成ライブラリ |

依存関係は意図的に最小限としている。UI コンポーネントライブラリは導入せず、画面が単一であるため
ルーターも使用しない。必要が生じた時点で追加する。

## ディレクトリ構成

```
src/
  main.ts                  # エントリポイント。app の生成、Pinia の install、mount
  App.vue                  # ルートコンポーネント。全体のレイアウト
  assets/                  # CSS、静的ファイル
  types/
    weather.ts             # API データおよびドメインモデルの型定義
  services/
    weatherApi.ts          # Open-Meteo の呼び出し（ジオコーディングと予報）。Vue を含めない
    weatherCodes.ts        # WMO 天気コードからラベルとアイコンへの変換
  stores/
    useWeatherStore.ts     # Pinia ストア。地点、予報、アクション、更新
    useSettingsStore.ts    # Pinia ストア。単位、テーマ（ストレッチ）
  components/
    LocationSearch.vue     # 検索入力と結果のドロップダウン
    LocationCard.vue       # 1 都市分。現在の気象状況とグラフ
    CurrentConditions.vue  # 気温・湿度・風速の表示
    HourlyChart.vue        # 24 時間の折れ線グラフ
    DailyChart.vue         # 7 日間のグラフ（ストレッチ）
    BaseSpinner.vue        # 再利用可能なローディング表示
  composables/
    useAutoRefresh.ts      # クリーンアップを含む、再利用可能な定期実行処理（ストレッチ）
```

**設計方針: サービス層に Vue を含めない。** `services/` と `types/` は Vue を一切 import しない純粋な
TypeScript とする。単体テストが可能であり、他のプロジェクトへの再利用もできる。Vue のリアクティビティが
関与するのは、ストアとコンポーネントに限られる。ドメイン層およびサービス層を Web フレームワークから
分離する考え方と同一である。

## コンポーネントツリー

```
App.vue
├── LocationSearch.vue        (都市をストアに追加する)
└── store.locations を v-for:
    └── LocationCard.vue      (props: location)
        ├── CurrentConditions.vue   (props: 現在のデータ)
        ├── HourlyChart.vue         (props: 時間別データ)
        └── DailyChart.vue          (props: 日別データ)   ← ストレッチ
```

コンポーネントは可能な限り表示に専念させる。データは **props** で受け取り、上位へは**イベント**で
伝達する。API を直接呼び出すことはせず、ストアに委譲する。これが「props down, events up」の原則であり、
Vue アプリケーションの追跡可能性を支えている。

## データフロー

中核となる処理の流れを次に示す。

```
                    ┌─────────────────────────────┐
   ユーザーが都市を入力  │        LocationSearch        │
  ─────────────────▶│  store.addLocation() を呼ぶ    │
                    └───────────────┬──────────────┘
                                    │ アクション
                                    ▼
        ┌───────────────────────────────────────────────┐
        │              useWeatherStore (Pinia)           │
        │  state: locations[], forecasts{}, loading, err │
        │  action addLocation():                         │
        │     → weatherApi.geocode()                     │
        │     → weatherApi.getForecast()                 │
        │     → 状態を変更（リアクティブ）                   │
        └───────────────┬───────────────────────────────┘
                        │ 状態の変更が自動的に伝播する
                        ▼
        ┌───────────────────────────────────────────────┐
        │  コンポーネントはストアの状態を読み、自動的に         │
        │  再描画される。DOM を直接操作することはない。        │
        └───────────────────────────────────────────────┘
```

重要な点は、**コンポーネントが状態を直接変更せず、API も直接呼び出さない**ことである。コンポーネントが
行うのはアクションの起動のみであり、非同期処理と状態の更新はアクションが担当する。その結果として画面が
再描画される。流れは常に一方向となる。表示に不整合がある場合、調査対象は DOM ではなくストアである。

## リアクティビティの仕組み（Java エンジニア向け）

Java において `int temp = 20;` を画面に描画した後で `temp` を変更しても、UI は変化しない。再描画を
明示的に行う必要がある。Vue は状態をリアクティブなプロキシでラップすることで、この処理を自動化している。

コンポーネントのテンプレートで `store.temp` を参照すると、Vue は「このコンポーネントは `temp` に依存する」
という関係を記録する。その後に値が代入されると、再実行すべきコンポーネントが特定できる。
`computed(() => a + b)` は入力が変化するまで結果をキャッシュする導出値であり、キャッシュ付きのゲッターに
相当する。`watch(source, cb)` は値の変化を監視して副作用を実行するものであり、「都市が変わったら再取得する」
といった処理に用いる。リアクティビティの仕組みはこれで全体である。
