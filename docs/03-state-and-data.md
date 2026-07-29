# 03 — 状態とデータ

本ドキュメントが扱う範囲がアプリケーションの中核である。ドメインモデルと集計処理が固まれば、
コンポーネントの実装はほぼ自動的に決まる。

## 基本方針: 保存するのは打刻の列だけ

勤怠アプリの設計では、次の 2 つが考えられる。

| 方式 | 保存するもの | 修正の意味 |
|------|------------|----------|
| **イベントログ方式**（採用） | 打刻 1 件ずつ | 個々の打刻を編集・追加・削除する |
| 日次レコード方式 | 1 日 1 件のレコード | その日のフォームを編集する |

本プロジェクトはイベントログ方式を採用する。実際の打刻機に近く、休憩を複数回取る場合や中抜けにも
そのまま対応できる。また、集計を保存しないため、打刻と集計が食い違うことがない。

## ドメインモデル（`src/types/attendance.ts`）

```ts
// 実行時にも値の一覧が必要なため、as const の配列から型を導出する（docs/05 §3）
export const PUNCH_TYPES = ['clock-in', 'break-start', 'break-end', 'clock-out'] as const
export type PunchType = (typeof PUNCH_TYPES)[number]

// 保存されるのはこれだけ
export interface Punch {
  readonly id: string
  readonly type: PunchType
  readonly at: string   // ローカル時刻 "YYYY-MM-DDTHH:mm"
}

export type WorkStatus = 'before-work' | 'working' | 'on-break' | 'after-work'

// 打刻の不整合。判別可能なユニオン（docs/05 §7）
export type PunchIssue =
  | { readonly kind: 'unclosed-work' }
  | { readonly kind: 'unclosed-break' }
  | { readonly kind: 'orphan-clock-out' }
  | { readonly kind: 'orphan-break-end' }

// すべて打刻列から導出される。保存はしない
export interface DaySummary {
  readonly date: string
  readonly punches: readonly Punch[]
  readonly presentMs: number      // 在社時間
  readonly breakMs: number        // 休憩時間
  readonly workedMs: number       // 実働 = 在社 - 休憩
  readonly status: WorkStatus
  readonly openSince: string | undefined
  readonly issues: readonly PunchIssue[]
}
```

### 時刻をローカルの文字列で持つ理由

打刻は `"2026-07-29T09:02"` という、タイムゾーン情報を持たない文字列で保持する。`Date` の ISO 文字列
（UTC）を用いない理由は次のとおりである。

- 勤怠では「9:02 に出勤した」という壁時計の時刻がそのまま記録である。UTC への変換は表示のたびに
  戻す必要があり、不要な複雑さを持ち込む。
- 桁数が固定されているため、辞書順の比較がそのまま時刻順になる。並べ替えに解析が要らない。
- 先頭 10 文字がそのまま日付キーになるため、日ごとのグループ化が容易である。

## 集計処理（`src/services/attendance.ts`）

本アプリケーションの中核であり、Vue を含まない純粋な TypeScript として単体テストできる。

### 現在時刻を参照しない

`summarizeDay` は現在時刻を引数に取らない。退勤していない勤務のような、区切られていない区間は経過
時間に加算せず、不整合として報告するだけにとどめる。

この判断により、集計は入力だけで結果が決まる純粋な関数になる。同じ打刻を渡せば常に同じ結果が返る
ため、テストが容易である。「勤務中の経過時間を実時間で表示する」という要求は、現在時刻を持つ
コンポーネント側（`useNow`）の責務として分離している。

```ts
export function summarizeDay(date: string, punches: readonly Punch[]): DaySummary
```

### 集計のアルゴリズム

打刻を時刻順にたどり、対になる打刻から時間を積み上げる。

| 打刻 | 処理 |
|------|------|
| `clock-in` | 勤務の開始時刻を保持する。すでに保持していれば `unclosed-work` |
| `clock-out` | 開始時刻との差を在社時間へ加算する。開始が無ければ `orphan-clock-out` |
| `break-start` | 休憩の開始時刻を保持する。すでに保持していれば `unclosed-break` |
| `break-end` | 開始時刻との差を休憩時間へ加算する。開始が無ければ `orphan-break-end` |

最後まで対にならなかった区間は、時間に加算せず不整合として報告する。対ごとに加算するため、1 日に
複数回の出退勤（中抜け）があっても正しく合計される。

```
09:00 出勤 / 12:00 退勤 / 13:00 出勤 / 18:00 退勤
  → 在社 8時間、実働 8時間、不整合なし
```

### 打てる打刻の制御

```ts
export function allowedPunchTypes(status: WorkStatus): readonly PunchType[]
```

| 状態 | 打てる打刻 |
|------|----------|
| `before-work` | 出勤 |
| `working` | 休憩開始、退勤 |
| `on-break` | 休憩終了 |
| `after-work` | 出勤（中抜けからの再出勤） |

画面ではボタンを 4 つとも表示したうえで、打てないものを無効にする。ボタンの位置が状態によって動か
ないため、押し間違いが起きにくい。

## 保存層（`src/services/punchStorage.ts`）

`localStorage` への保存と読み込みを担当する。キーは `timecard.punches.v1` である。

### 読み込み時に検証する理由

`localStorage` は API と同じく外部の境界であり、返ってくる値に型の保証はない。利用者が開発者ツールで
書き換えることもでき、アプリの旧版が別の形式で書いたデータが残っている可能性もある。そのため
`JSON.parse` の結果を `unknown` として受け、1 件ずつ検証して条件を満たさないものは捨てる
（docs/05 §6）。

```ts
export function loadPunches(): Punch[]                       // 壊れていれば空配列
export function savePunches(punches: readonly Punch[]): void // 失敗時は例外
export function createPunchId(): string
```

読み込みは起動時の 1 回だけであり、ここで失敗してアプリが使えなくなっては困る。そのため壊れたデータは
例外にせず、空の状態として扱う。一方、保存の失敗（保存領域の上限など）は利用者に伝える必要があるため
例外として送出し、ストアが受け取って `error` に反映する。

## Pinia ストア（`src/stores/useAttendanceStore.ts`）

グローバルな状態を配置する場所が Pinia である。1 つのストアは、状態を保持しメソッドを公開する
シングルトンのサービス Bean に相当する。

### 構成

| 要素 | 内容 |
|------|------|
| **state** | `punches`（打刻の列）、`error` |
| **getters** | `days`（日付ごとの集計。新しい日が先頭） |
| **actions** | `punch`、`addPunch`、`updatePunch`、`removePunch`、`summaryFor` |

状態として保持するのは `punches` だけである。`days` は `computed` であり、打刻を 1 件修正すれば集計も
表示も自動的に追随する。

```ts
export const useAttendanceStore = defineStore('attendance', () => {
  const punches = ref<Punch[]>(loadPunches())
  const error = ref<string | null>(null)

  const days = computed<DaySummary[]>(() => summarizeByDate(punches.value))

  watch(punches, (value) => { savePunches(value) }, { deep: true })

  function punch(type: PunchType, atMs: number = Date.now()): void { /* ... */ }
  function addPunch(type: PunchType, at: string): boolean { /* ... */ }
  function updatePunch(id: string, type: PunchType, at: string): boolean { /* ... */ }
  function removePunch(id: string): void { /* ... */ }

  return { punches, error, days, summaryFor, punch, addPunch, updatePunch, removePunch }
})
```

### 保存を `watch` で行う理由

各アクションの末尾で保存を呼ぶ方法もあるが、それではアクションを追加するたびに保存漏れが起こりうる。
`watch` で状態の変化に反応させておけば、保存の責務がこの 1 か所にまとまる。

配列の中身（既存の打刻の時刻）を書き換えても反応させたいため `deep: true` を指定している。

> ⚠️ `updatePunch` では要素を書き換えるのではなく `splice` で差し替えている。オブジェクトのプロパティを
> 直接変更しても `deep` な `watch` は反応するが、要素ごと差し替えるほうが変更の伝播が明確であり、
> `readonly` を付けたドメイン型とも整合する。

## 現在時刻の扱い（`src/composables/useNow.ts`）

集計が現在時刻を参照しないため、実時間の表示はコンポーネント側で行う。`useNow` は
`useAutoRefresh` を用いて一定間隔で更新される現在時刻を返す。

`PunchPanel` では、この現在時刻に依存する `computed` を経過時間の算出だけに限定している。確定済みの
集計は `now` を参照しないため、1 秒ごとに再計算されることはない。
