# 05 — TypeScript コーディング規約

Java エンジニアを対象とした規約である。TypeScript が Java と異なる点、および静的型付けの
オブジェクト指向の経験がある場合に誤解しやすい点を中心に扱う。ここに定めた規則は本プロジェクトで
実際に適用するものであり、`CLAUDE.md` からも参照している。

> **AI アシスタントへ（必須）。** ここに定めた規則は、コードを記述または変更する際に必ず守ること。
> コミットを提案する前に、変更したファイルを本規約および `CLAUDE.md` のアーキテクチャ規約と照合し、
> 違反があれば先に修正すること。そのうえで、確認した規則を述べること。規約に違反したコードを
> コミットしてはならない。

## ハウスルール（常に適用する。詳細は後述）

- **型を厳格に扱う。** `strict` は無効化せず、`any` も使用しない。エラーが発生した場合は、抑制する
  のではなく型を修正する（§1、§6）。
- **比較は小さい順に記述する。`>` `>=` ではなく `<` `<=` を使う。** 小さい値を左に置くと、条件式が
  数直線と同じ並びになる（§12）。
- **等値比較には `===` / `!==` を使う。`==` は使用しない**（§12）。
- **既定は `const` とする。** 再代入が必要な場合にのみ `let` を使う（§12）。
- **配列の処理には `map` / `filter` / `reduce` を用い、`for` ループは避ける**（§13）。
- **関数には JSDoc を記述する。コメントには「何を」ではなく「なぜ」を書く**（§14）。

## 0. 最大の相違点: 構造的部分型

Java の型は**名前的**（nominal）であり、`implements Foo` と宣言してはじめてその型として扱われる。
一方 TypeScript の型は**構造的**（structural）であり、型名に関係なく、構造が一致すれば適合する。
必要なフィールドを備えていればよく、`implements` による宣言は不要である。

```ts
interface Point { x: number; y: number }
const p = { x: 1, y: 2, label: "a" }
const q: Point = p   // ✅ 適合する。x と y を持つため、余分な label があっても問題ない
```

したがって TypeScript のインターフェースは、明示的に実装を宣言する契約ではなく、構造の記述である。

## 1. tsconfig — 厳格な設定を必須とする

型チェックは最も厳格な設定で運用する。本プロジェクトの `tsconfig.json` は次のとおりである。

```jsonc
{
  "compilerOptions": {
    "strict": true,                       // 他の厳格化オプションをまとめて有効にする。常に有効
    "noUncheckedIndexedAccess": true,     // arr[i] の型が T ではなく T | undefined になる
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`strict` を有効にすると、`strictNullChecks` や `noImplicitAny` などが一括で有効になる。**エラーを
解消する目的で厳格さを緩めてはならない。** 修正すべきなのは型のほうである。JavaScript ではなく
TypeScript を採用している理由がここにある。

## 2. type と interface の使い分け

- オブジェクトおよびドメインの構造には **`interface`** を用いる（`Punch`、`DaySummary` など）。
  Java のクラスの構造に最も近く、宣言のマージにも対応する。
- ユニオン、プリミティブ、タプル、関数型、ユーティリティ型の合成には **`type`** を用いる。

```ts
interface Punch { id: string; at: string }                     // オブジェクトの構造
type WorkStatus = "working" | "on-break"                        // ユニオン。interface では表現できない
type Range = [number, number]                                   // タプル
type Summarizer = (punches: readonly Punch[]) => DaySummary     // 関数型
```

インターフェースに `I` は付けない。`IPunch` のような命名は C# や一部の Java 環境の慣習であり、
TypeScript では `Punch` と記述する。型名は `PascalCase` とする（命名規約は §16）。

## 3. `enum` ではなく文字列リテラルのユニオンを用いる

Java の `enum` に相当する場面では、TypeScript ではユニオン型を用いる。構造が単純で、実行時には
文字列として扱われ、値を使用する際に import も不要である。

```ts
// ✅ 推奨
type WorkStatus = "before-work" | "working" | "on-break" | "after-work"

// ⚠️ 実行時に enum オブジェクトが必要な場合を除き、使用しない
enum WorkStatusEnum { BeforeWork, Working }
```

固定された集合を実行時にも値のリストとして保持する場合は `as const` を用いる。本プロジェクトの
`PunchType` はこの形で定義している。画面のボタンを打刻の種別から生成するため、実行時にも一覧が必要と
なるからである。

```ts
export const PUNCH_TYPES = ["clock-in", "break-start", "break-end", "clock-out"] as const
export type PunchType = (typeof PUNCH_TYPES)[number]   // "clock-in" | ... | "clock-out"
```

## 4. null と undefined — 既定の「値なし」は `undefined`

Java には `null` のみが存在するが、TypeScript には `null` と `undefined` の両方がある。TypeScript で
一般的に用いられるのは `undefined` である（プロパティが存在しない、戻り値がない、など）。`null` は
「意図的に空にした」ことを表す場合に限って用いる。本プロジェクトでは **`undefined` を基本**とし、
`null` は値が意味的にクリアされた場合にのみ使用する（`error: string | null`、および `PunchForm` の
`punch: Punch | null` が該当する）。

```ts
function findPunch(id: string): Punch | undefined { /* ... */ }

const label = punch?.type ?? "不明"   // オプショナルチェーンと null 合体演算子
```

- `?.` はオプショナルチェーンであり、null または undefined の時点で評価を打ち切る。null セーフな
  ナビゲーションに相当する。
- `??` は null 合体演算子である。フォールバックが働くのは null と undefined の場合のみで、`0` や
  `""` では働かない。この点が `||` との違いであり、デフォルト値の指定には `??` を用いる。

## 5. 境界に型を記述し、内部は推論に委ねる

Java はすべての箇所に型の記述を要求するが、TypeScript の型推論は強力である。過剰な型注釈は
かえって可読性を損なう。

**方針は「境界には記述し、内部には記述しない」である。** 関数の引数と戻り値、および export する
モジュールレベルの API には型を明示する。ローカル変数は推論に委ねる。

```ts
// ✅ シグネチャ（＝契約）は明示し、ローカル変数は推論に委ねる
export function summarizeDay(date: string, punches: readonly Punch[]): DaySummary {
  const ordered = sortByTime(punches)     // Punch[] と推論されるため、型注釈は不要
  const issues: PunchIssue[] = []         // 空配列は型が定まらないため注釈する
  // ...
}
```

export した関数に戻り値の型を明記するのは意図的な規則である。関数の意図が明確になり、リファクタ
リングによって公開型が意図せず変化することも防げる。

## 6. `any` を禁止し、型のない境界では `unknown` を用いる

`any` を使用すると、その箇所で型チェックが機能しなくなる。本プロジェクトで型のない値が入ってくる
境界は `localStorage` である。`JSON.parse` の戻り値は `any` であるため、受け取った直後に `unknown`
として扱い、検証を経てから使用する。

```ts
const parsed: unknown = JSON.parse(raw)
return Array.isArray(parsed) ? parsed.filter(isPunch) : []
```

- `unknown` は「型が未確定であり、使用前に確認を要する」ことを表す。安全側に倒した型である。
- `any` は「その箇所で型チェックを無効化する」ことを意味するため使用しない。やむを得ない場合は
  `// eslint-disable` と理由を併記する。
- 型アサーション（`x as Foo`）は最終手段である。検証を伴わずに型を断定するにすぎないため、通常は
  型ガードや `in`、`typeof`、`Array.isArray` による絞り込みを用いる。`punchStorage.ts` の `isPunch` が
  型ガードの例であり、`as Record<string, unknown>` を挟むのは各フィールドを個別に確認するための
  前段としてである。

## 7. 状態は判別可能なユニオンで表現する

判別可能なユニオンは、TypeScript の型システムを最も活かせる機能の一つである。Java の sealed クラスに
対するパターンマッチと同じ役割を、より簡潔に記述できる。共通のリテラルフィールド（*判別子*）を
持たせることで、コンパイラが網羅的に型を絞り込む。

本プロジェクトでは打刻の不整合をこの形で表している。

```ts
export type PunchIssue =
  | { readonly kind: "unclosed-work" }
  | { readonly kind: "unclosed-break" }
  | { readonly kind: "orphan-clock-out" }
  | { readonly kind: "orphan-break-end" }

export function describeIssue(issue: PunchIssue): string {
  switch (issue.kind) {
    case "unclosed-work":    return "退勤の打刻がありません"
    case "unclosed-break":   return "休憩終了の打刻がありません"
    case "orphan-clock-out": return "対応する出勤がない退勤があります"
    case "orphan-break-end": return "対応する休憩開始がない休憩終了があります"
  }
}
```

`switch` が判別子をすべて網羅しているため、`PunchIssue` に種類を追加すると戻り値の型が合わなくなり、
コンパイラがこの関数の修正漏れを検出する。不正な状態そのものを表現できなくする点も重要であり、
真偽値の組み合わせ（`hasError`、`isMissing` など）よりもこの表現を優先する。

## 8. イミュータビリティ

既定ではイミュータブルとする。変更してはならないフィールドには `readonly` を、読み取り専用の配列には
`readonly T[]` または `ReadonlyArray<T>` を用いる。

```ts
interface Punch {
  readonly id: string
  readonly type: PunchType
  readonly at: string
}
```

集計処理が受け取る打刻も `readonly Punch[]` としている。入力を書き換えないことが型として保証され、
呼び出し側は渡した配列がそのまま残ることを前提にできる。

## 9. ジェネリクスとユーティリティ型

ジェネリクスは Java の `<T>` とほぼ同等であり、変性の扱いもおおむね共通している。加えて TypeScript
には、既存の型を変換する**ユーティリティ型**がある。次の 5 種類は使用頻度が高い。

| ユーティリティ | 効果 | 例 |
|---------|------|---------|
| `Partial<T>` | 全フィールドを省略可能にする | 部分更新用の `Partial<Punch>` |
| `Pick<T, K>` | 一部のフィールドのみ残す | `Pick<DaySummary, "workedMs">` |
| `Omit<T, K>` | 一部のフィールドを除外する | 新規打刻の入力用の `Omit<Punch, "id">` |
| `Record<K, V>` | マップおよび辞書の型 | `Record<PunchType, string>`（表示名の対応表） |
| `Readonly<T>` | 全フィールドを readonly にする | `Readonly<DaySummary>` |

`Record<PunchType, string>` は `punchLabels.ts` で実際に用いている。キーがユニオン型であるため、
打刻の種別を追加すると対応表の記述漏れをコンパイラが検出する。

## 10. モジュールと import

- ES モジュールのみを使用する。カプセル化はモジュール単位で行われ、`export` したものだけが外部に
  公開される。メンバーに対する `private`/`public` は存在せず、export しなければモジュール内に閉じる。
- 型のみを import する場合は **`import type`** を用いる。JavaScript の出力から除去されるためである。

```ts
import type { DaySummary, Punch } from "@/types/attendance"
import { summarizeDay } from "@/services/attendance"
```

- `src/` 配下の import には `@/` のパスエイリアス（Vite および tsconfig で設定済み）を用い、
  `../../..` の連鎖は記述しない。

## 11. 非同期処理とエラー処理

本アプリケーションは通信を行わないため非同期処理はほとんど現れないが、規約は次のとおりである。

- 非同期処理は `Promise<T>` と `async`/`await` で記述する。`CompletableFuture` に相当するが、記法は
  より簡潔である。
- strict モードでは `catch` が受け取る値の型が `Error` ではなく **`unknown`** になるため、使用前に
  絞り込む必要がある。

```ts
try {
  savePunches(value)
} catch (e) {
  error.value = e instanceof Error ? e.message : "保存に失敗しました"
}
```

- エラーを握りつぶさない。ストアの状態に反映し（`error.value = ...`）、UI が反応できるようにする。
  ただし起動時の読み込みは例外であり、壊れたデータでアプリが使えなくなることを避けるため空の状態と
  して扱う。この判断の理由は `punchStorage.ts` のコメントに記載している。

## 12. 演算子・等値比較・スタイル

- **等値比較には `===` / `!==` を使う。** `==` は意図しない型変換を伴うため使用しない。例外は認めない。
- **既定は `const` とする。** 再代入が必要な場合にのみ `let` を用い、`var` は使用しない。集計処理の
  ループ内で積算する変数は、再代入が本質であるため `let` が適切である。
- コールバックおよびインライン関数にはアロー関数を用いる。`this` の挙動は Java と異なるが、
  `<script setup>` および Pinia の setup ストアでは `this` を扱う場面はほとんどない。

**`>` `>=` ではなく `<` `<=` を用いる。** 小さい値を左に置き、式が数直線と同じ並びになるようにする。

```ts
if (0 < summary.issues.length) { /* ... */ }        // ✅
if (0 <= i && i < punches.length) { /* ... */ }      // ✅ 範囲の判定が左から右へ自然に読める

if (summary.issues.length > 0) { /* ... */ }         // ⚠️ 意味は同じだが、読む向きが逆になる
```

## 13. ループではなく配列メソッドを用いる

Java の Stream に相当する記法である。配列に `push` していく `for` ループではなく、宣言的な配列
メソッドでデータを変換する。処理の流れを上から順に追うことができ、添字の誤りや意図しない変更に
起因するバグも避けられる。新しい配列を返すため、§8 のイミュータビリティとも整合する。

```ts
const workedMinutes = [495, 462, 510, 438]

// ✅ Java の Stream パイプラインと同様に、途中経過を保持する変数を必要としない
const longDays = workedMinutes
  .filter((minutes) => 480 <= minutes)
  .map((minutes) => `${Math.floor(minutes / 60)}時間${minutes % 60}分`)

// ⚠️ 単純な変換にこの記法は用いない
const longDays2: string[] = []
for (const minutes of workedMinutes) {
  if (480 <= minutes) longDays2.push(`${Math.floor(minutes / 60)}時間${minutes % 60}分`)
}
```

Java Stream と TypeScript の配列メソッドの対応は次のとおりである。

| Java Stream | TypeScript の配列メソッド |
|-------------|-----------------|
| `map` | `map` |
| `filter` | `filter` |
| `reduce` | `reduce` |
| `findFirst` | `find` |
| `anyMatch` | `some` |
| `allMatch` | `every` |
| `flatMap` | `flatMap` |
| `sorted` | `toSorted()`（イミュータブル）または `[...arr].sort()` |
| `collect(toList())` | （すでに配列である） |

**ループが適する場面もある。** `break` や `continue` を要する場合、および要素ごとに逐次 `await` する
場合（`.forEach` の内部では `await` が正しく機能しない）は `for...of` を用いる。`summarizeDay` が
`for...of` で打刻をたどっているのも適切な使用例である。直前までの状態（勤務の開始時刻など）を保持
しながら順に処理する必要があり、配列メソッドでは表現しにくいためである。

## 14. ドキュメントとコメント

**関数には JSDoc を記述する**（export するものは必須とする）。TypeScript における Javadoc に相当し、
エディターがホバー時に表示する。型はシグネチャに記述されているため、`@param` で型を繰り返さない。
記述するのは型ではなく*意味*である。

```ts
/**
 * 1 日分の打刻を集計する。
 *
 * @param date - 対象の日付キー "YYYY-MM-DD"
 * @param punches - その日の打刻。順序は問わない
 * @returns 集計結果
 */
export function summarizeDay(date: string, punches: readonly Punch[]): DaySummary { /* ... */ }
```

**コメントには「何を」ではなく「なぜ」を記述する。**

- *何を*しているかはコードから読み取れる。コメントに記述するのは*意図*である。その方法を選んだ理由、
  トレードオフ、自明でない制約などが対象となる（例:「集計が現在時刻を参照しないのは、入力だけで
  結果が決まる純粋な関数に保つためである」）。
- コメントの内容は正確かつ最新の状態に保つ。古いコメントは無いよりも有害であるため、コードの変更に
  合わせて修正または削除する。
- 自明な内容は記述しない（`// i をインクリメント`）。コードの理解のためだけにコメントを要する場合は、
  まず命名の見直しや処理の分割を検討する。
- `// TODO:` `// FIXME:` は経緯を伴う場合に限り許容する。放置してはならない。

## 15. Vue と TypeScript

本プロジェクトで使用する型付けのパターンは次のとおりである。

```ts
// リアクティブな ref は型を保持する
const editingId = ref<string | null>(null)   // 初期値だけでは型が定まらないため注釈する
const punches = ref<Punch[]>([])

// 型付きの props。コンパイル時のみで、実行時の宣言は不要
const props = defineProps<{ summary: DaySummary }>()

// 型付きの emit
const emit = defineEmits<{
  (e: "edit", id: string): void
  (e: "remove", id: string): void
}>()

// Pinia の setup ストア。state/getters/actions はすべて推論され、型が付与される
// （ストア全体は docs/03-state-and-data.md を参照）
```

初期値だけでは型が確定しない場合（`ref<Punch[]>([])` や `null` で初期化する ref など）は
`ref`/`computed` に型を記述し、それ以外は推論に委ねる。

## 16. 命名規約

命名が統一されていると、コードの見通しがよくなる。以下のケーシングは TypeScript コミュニティの
標準であり、多くは Java から直接移行できる。相違点は末尾にまとめる。

| 種類 | ケース | 例 |
|------|------|---------|
| 変数、引数、オブジェクトのプロパティ | `camelCase` | `workedMs`、`editingId` |
| 関数・メソッド | `camelCase`、動詞から始める | `summarizeDay`、`parseDateTime`、`formatDuration` |
| 型、インターフェース、クラス、enum | `PascalCase` | `Punch`、`DaySummary`、`WorkStatus` |
| enum のメンバー | `PascalCase` | `WorkStatus.Working` |
| モジュールレベルの定数 | `UPPER_SNAKE_CASE` | `PUNCH_TYPES`、`DEFAULT_INTERVAL_MS` |
| ジェネリック型引数 | `PascalCase`、意味の分かる名前 | `TItem`、`TResponse`（自明な場合は `T`） |
| Vue コンポーネント | `PascalCase` | `DayCard.vue` |
| ファイル（コンポーネント以外） | `CLAUDE.md` を参照 | `punchStorage.ts`、`useAttendanceStore.ts` |

**個別の注意点は次のとおりである。**

- **値は `camelCase`、型は `PascalCase` とする。** Java とほぼ同じである。相違点は、*インターフェース*も
  `PascalCase` とし、`I` を付けないことである（§2）。
- **定数について。** `UPPER_SNAKE_CASE` を用いるのは真の固定値に限る（設定値、および名前を与えた
  マジックナンバー）。Java の `static final` に相当する。ローカルの値を保持するだけの `const` は
  `camelCase` のままとする。すなわち `const DEFAULT_INTERVAL_MS = 1000` は `UPPER_SNAKE` とするが、
  `const ordered = sortByTime(punches)` は `camelCase` とする。
- **真偽値は可否を問う形の名前とする。** `is` / `has` / `should` / `can` を接頭辞に用い、`isAdding`、
  `isRunning`、`canPunch` のように命名する。否定形は避ける（`isNotReady` ではなく `isReady`）。
- **関数は動詞から始める。** `summarizeDay`、`loadPunches`、`formatDuration`、`removePunch` などで
  ある。Java Bean と異なり TypeScript ではプロパティを `get` なしで参照するが（`punch.getType()` では
  なく `punch.type`）、処理を伴う関数は動詞で始める。
- **ハンガリアン記法および型の接頭辞は用いない。** インターフェースの `I`、型エイリアスの `T`、
  `str`/`arr` などは付けない。型の情報は型システムが保持しているため、名前に含める必要はない。
- **省略形による可読性の低下を避ける。** `dur` ではなく `duration`、`idx` ではなく `index` を用いる
  （ごく狭いスコープのループ変数 `i` は許容する）。名前は仕様を伝える情報でもある。
- **単位を名前に含める。** ミリ秒を保持する値は `workedMs`、`intervalMs` のように末尾へ単位を付ける。
  数値型だけでは単位が判別できず、秒とミリ秒の取り違えは実際に起こりやすい。
- **コンポーザブルとストア**は `CLAUDE.md` に従い、`useX`（`useAutoRefresh`、`useNow`）、`useXStore`
  （`useAttendanceStore`）とする。`use` は、リアクティブな状態を扱うことを示す Vue の慣習である。
- **emit するイベント名**は動詞を基本とし、呼び出し側およびハンドラー側では `kebab-case` とする。
  `emit('remove', id)` を `@remove` で受ける。

**Java との相違点は次のとおりである。**

- インターフェース: Java の `IFoo` / `FooImpl` は、TypeScript では `Foo` とする（構造的部分型による。§0）。
- ゲッター: Java の `getName()` / `isActive()` は、TypeScript ではプロパティを直接参照する
  （`name`、`active`）。動詞を保持するのは、計算または取得を伴う関数に限る。
- 定数: Java の `static final MAX`（`UPPER_SNAKE`）は、真の定数であれば TypeScript でも同一である。
- パッケージおよびクラス → ファイル: モジュールは `camelCase.ts`、コンポーネントは `PascalCase.vue` とする。

## Java → TypeScript 早見表

| Java | TypeScript |
|------|------------|
| `interface`／クラスの構造 | `interface`（構造的部分型のため `implements` は不要） |
| `enum Color { RED }` | `type Color = "red" \| "green"`（ユニオン。こちらを用いる） |
| `null` | `undefined`（既定の「値なし」）。`null` は意図的に空にする場合のみ |
| `Optional<T>` | `T \| undefined` と `?.`、`??` |
| `Objects.requireNonNull`／null チェック | strict な null チェックによりコンパイル時に検出される |
| `List<T>` | `T[]` または `Array<T>` |
| `Map<K,V>` | `Record<K,V>`（オブジェクト）または `Map<K,V>`（Map インスタンス） |
| `sealed interface` + パターンマッチの switch | 判別可能なユニオンと、判別子に対する `switch` |
| ジェネリクス `<T>` | ジェネリクス `<T>`（ほぼ同一） |
| `final` | `const`（変数）、`readonly`（フィールド） |
| `==`（参照）／`.equals` | `===`（プリミティブは値の比較）。常に `===` を用いる |
| `CompletableFuture<T>` | `Promise<T>` + `async`/`await` |
| package-private／`private` | モジュールから export しない |
