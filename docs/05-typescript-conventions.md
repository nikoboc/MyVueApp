# 05 — TypeScript Coding Conventions

Written for a Java engineer. The focus is where TS **differs** from Java or where its idioms surprise
people with a statically-typed OO background. These are the rules we follow in this project; they're also
enforced in spirit by `CLAUDE.md`.

> **For AI assistants — mandatory.** Every rule in this document MUST be followed when writing or
> changing code. Before proposing a commit, review each touched file against these conventions (and the
> architecture rules in `CLAUDE.md`), fix any violations first, and note which rules you checked. Do not
> commit code that violates them.

## House rules (always follow — details below)

- **Be strict to types.** `strict` tsconfig stays on, no `any`, never silence an error — fix the type
  (§1, §6).
- **Comparisons read low-to-high: prefer `<` / `<=` over `>` / `>=`.** Put the smaller value on the left so
  conditions read like a number line (§12).
- **Always `===` / `!==`, never `==`** (§12).
- **Use `const` by default**, `let` only when a binding is actually reassigned (§12).
- **Prefer functional array methods** (`map` / `filter` / `reduce`) over imperative `for` loops (§13).
- **JSDoc every function; comment the _why_, not the _what_** (§14).

## 0. The one big difference: structural typing

Java is **nominal** — a value fits a type only if it *declares* it (`implements Foo`). TypeScript is
**structural** — a value fits a type if its *shape* matches, regardless of names. If it has the right
fields, it's compatible. No `implements` needed.

```ts
interface Point { x: number; y: number }
const p = { x: 1, y: 2, label: "a" }
const q: Point = p   // ✅ OK — extra `label` is fine; shape includes x and y
```

Consequence: interfaces describe shapes, not contracts you must explicitly opt into. Lean on this.

## 1. tsconfig — strictness is mandatory

Turn the safety all the way up. Our `tsconfig.json` sets:

```jsonc
{
  "compilerOptions": {
    "strict": true,                       // the umbrella flag — always on
    "noUncheckedIndexedAccess": true,     // arr[i] is T | undefined, not T (huge for correctness)
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

`strict` implies `strictNullChecks`, `noImplicitAny`, and more. **Never disable strictness to make an
error go away** — fix the type. This is the whole point of using TS over JS.

## 2. Types vs. interfaces

- **`interface`** for object/domain shapes (our `Location`, `Forecast`, etc.). It's the closest thing to
  a Java class-shape and supports declaration merging.
- **`type`** for unions, primitives, tuples, function types, and mapped/utility compositions.

```ts
interface Location { id: string; name: string }        // object shape
type Units = "metric" | "imperial"                      // union — no `type` equivalent as interface
type Coord = [number, number]                            // tuple
type Fetcher = (loc: Location) => Promise<Forecast>      // function type
```

**No `I` prefix** on interfaces (`ILocation` is a C#/some-Java-shop habit; the TS community uses plain
`Location`). Type names are `PascalCase`. (Full naming rules: §16.)

## 3. Prefer string-literal unions over `enum`

Coming from Java you'll reach for `enum`. In TS, **prefer union types** — they're simpler, erase to plain
strings at runtime, and need no import to use the values.

```ts
// ✅ preferred
type WeatherView = "hourly" | "daily"

// ⚠️ avoid unless you truly need a runtime enum object
enum WeatherViewEnum { Hourly, Daily }
```

For a fixed set with a runtime value list, use `as const`:

```ts
export const UNITS = ["metric", "imperial"] as const
export type Units = (typeof UNITS)[number]   // "metric" | "imperial"
```

## 4. Nullability: `undefined` is the default absence

Java has `null`. TS has **both** `null` and `undefined`, but idiomatic TS leans on `undefined` (missing
property, no return). Use `null` only to mean "explicitly empty." In this project: **prefer `undefined`**;
use `null` only where an API/domain value is meaningfully "cleared" (e.g. `error: string | null`).

```ts
function find(id: string): Location | undefined { /* ... */ }

const name = loc?.name ?? "Unknown"   // optional chaining + nullish coalescing
```

- `?.` — optional chaining (short-circuits on null/undefined). Like a null-safe navigation.
- `??` — nullish coalescing. Falls back **only** on null/undefined (not on `0` or `""`, unlike `||`).
  Prefer `??` over `||` for defaults.

## 5. Annotate boundaries, infer the middle

Java makes you type everything. TS has strong inference — over-annotating is noise.

**Rule:** explicitly type **function parameters, return types, and exported/module-level API**. Let TS
**infer local variables**.

```ts
// ✅ signature is explicit (the contract); locals are inferred
export async function getForecast(loc: Location): Promise<Forecast> {
  const url = buildUrl(loc)           // inferred string — no annotation needed
  const res = await fetch(url)        // inferred Response
  const json = await res.json()       // `any` — see §6, must be tamed
  return mapForecast(json)
}
```

Explicit return types on exported functions are a deliberate rule: they document intent and stop an
accidental refactor from silently changing a function's public type.

## 6. Ban `any`; use `unknown` at untyped boundaries

`any` disables the type checker — it's a hole in the hull. `res.json()` returns `any`, so **tame it
immediately**: treat external data as `unknown` and validate/narrow before use.

```ts
const json: unknown = await res.json()
// then narrow: guard fields, or (pragmatically for this learning project) assert into a raw response type
```

- `unknown` = "I don't know the type yet, force me to check." Safe.
- `any` = "turn off checking here." Avoid. If you must, leave a `// eslint-disable` + a reason.
- Type assertions (`x as Foo`) are an escape hatch, not a tool — they *assert* without *checking*. Prefer
  real narrowing (type guards, `in`, `typeof`, `Array.isArray`). Use `as` only when you genuinely know
  more than the compiler (e.g., a validated API DTO).

## 7. Model state with discriminated unions

This is TS's superpower and worth learning early — it's the ergonomic version of Java sealed
classes / `switch` over a sealed hierarchy. A shared literal field (the *discriminant*) lets the compiler
narrow exhaustively.

```ts
type LoadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string }

function render(s: LoadState<Forecast>) {
  switch (s.status) {
    case "idle":    return "—"
    case "loading": return "Loading…"
    case "success": return s.data.current.temperature   // TS knows `data` exists here
    case "error":   return s.message                     // and `message` exists here
  }
}
```

Makes illegal states unrepresentable — you can't have `status: "success"` without `data`. Reach for this
instead of a bag of loose booleans (`isLoading`, `hasError`, `data?`).

## 8. Immutability

Default to immutable. Use `readonly` for fields that shouldn't change and `readonly T[]` /
`ReadonlyArray<T>` for arrays you only read.

```ts
interface Location {
  readonly id: string
  readonly latitude: number
}
```

## 9. Generics & utility types

Generics work like Java's (`<T>`), with the same variance intuitions mostly holding. Beyond that, TS ships
**utility types** that transform existing types — learn these five, you'll use them constantly:

| Utility | Does | Example |
|---------|------|---------|
| `Partial<T>` | all fields optional | `Partial<Location>` for a patch |
| `Pick<T, K>` | keep some fields | `Pick<Forecast, "current">` |
| `Omit<T, K>` | drop some fields | `Omit<Location, "id">` for a "new location" input |
| `Record<K, V>` | map/dictionary type | `Record<string, Forecast>` (our forecasts map) |
| `Readonly<T>` | all fields readonly | `Readonly<Location>` |

## 10. Modules & imports

- ES modules only. Encapsulation is by **module boundary** — only `export`ed things are public. There are
  no `private`/`public` on module members; if it's not exported, it's module-private.
- Use **`import type`** for type-only imports so they're erased from the JS output:

```ts
import type { Location, Forecast } from "@/types/weather"
import { getForecast } from "@/services/weatherApi"
```

- Use the `@/` path alias (configured in Vite/tsconfig) for `src/`-relative imports — no `../../..` chains.

## 11. Async & error handling

- Async is `Promise<T>` + `async`/`await` (conceptually like `CompletableFuture`, but syntactically clean).
- In strict mode a `catch` binding is **`unknown`**, not `Error` — you must narrow before using it:

```ts
try {
  await getForecast(loc)
} catch (e) {
  const message = e instanceof Error ? e.message : "Unknown error"
}
```

- Don't swallow errors silently; surface them into store state (`error.value = ...`) so the UI can react.

## 12. Operators, equality & style

- **Always `===` / `!==`.** Never `==` (it does surprising coercion). This is non-negotiable.
- **Use `const` by default.** Reach for `let` only when a binding is genuinely reassigned; never `var`.
- Arrow functions for callbacks and inline functions. Beware `this` differs from Java — in `<script
  setup>` and Pinia setup stores you rarely touch `this` at all.

**Prefer `<` / `<=` over `>` / `>=`.** Order comparisons low-to-high so the smaller value sits on the left
and the expression reads like a number line:

```ts
if (temperature < threshold) { /* ... */ }        // ✅
if (0 <= i && i < items.length) { /* ... */ }      // ✅ bounds in natural left-to-right order

if (threshold > temperature) { /* ... */ }         // ⚠️ avoid — same meaning, reads backwards
```

## 13. Prefer functional array methods over loops

Coming from Java Streams this will feel familiar: transform data with declarative array methods rather than
imperative `for` loops that push into a mutable accumulator. They read top-to-bottom, sidestep off-by-one
and mutation bugs, and return new arrays (aligning with immutability, §8).

```ts
const temperatures = [18, 22, 15, 27, 20]

// ✅ functional — like a Java Stream pipeline, no mutable accumulator
const warmLabels = temperatures
  .filter(t => 20 <= t)
  .map(t => `${t}°C`)

// ⚠️ avoid the imperative version for simple transforms
const warmLabels2: string[] = []
for (const t of temperatures) {
  if (20 <= t) warmLabels2.push(`${t}°C`)
}
```

Java Stream → TS array method:

| Java Stream | TS array method |
|-------------|-----------------|
| `map` | `map` |
| `filter` | `filter` |
| `reduce` | `reduce` |
| `findFirst` | `find` |
| `anyMatch` | `some` |
| `allMatch` | `every` |
| `flatMap` | `flatMap` |
| `sorted` | `toSorted()` (immutable) or `[...arr].sort()` |
| `collect(toList())` | (already an array) |

**When a plain loop is fine:** use `for...of` when you need `break` / `continue`, or a sequential `await`
per item (you can't `await` cleanly inside `.forEach`). And don't twist `reduce` into an unreadable
one-liner — clarity wins. But for straightforward map/filter/find work, the functional form is the default.

## 14. Documentation & comments

**JSDoc every function** (exported ones especially). It's TS's Javadoc, and editors surface it on hover.
Because the signature is already typed, **don't** repeat types in `@param` — document *meaning*, not types.

```ts
/**
 * Fetches and normalizes the current, hourly, and daily forecast for a location.
 *
 * @param loc - the geocoded location to fetch weather for
 * @returns the mapped domain forecast
 * @throws if the Open-Meteo request fails or returns an unexpected shape
 */
export async function getForecast(loc: Location): Promise<Forecast> { /* ... */ }
```

**Comment properly — the _why_, not the _what_:**

- The code already says *what* it does; comments capture *intent*: why this approach, a tradeoff, a
  non-obvious constraint, or an external quirk (e.g. "Open-Meteo omits `results` when there are no matches").
- Keep comments **truthful and current**. A stale comment is worse than none — update or delete it when the
  code changes.
- Don't narrate the obvious (`// increment i`). If code needs a comment just to be understood, first ask
  whether clearer names or a small refactor would remove the need.
- `// TODO:` / `// FIXME:` are fine when they carry context, not as litter.

## 15. Vue + TypeScript specifics

The project-relevant typing patterns you'll actually use:

```ts
// Reactive refs carry their type:
const count = ref<number>(0)                 // Ref<number>; often inferred from initial value
const locations = ref<Location[]>([])

// Typed props (compile-time, no runtime declaration needed):
const props = defineProps<{ location: Location; compact?: boolean }>()

// Typed emits:
const emit = defineEmits<{ (e: "remove", id: string): void }>()

// Pinia setup store — state/getters/actions are all inferred and fully typed
// (see docs/03-state-and-data.md for the full store).
```

Rule of thumb: annotate `ref`/`computed` when the initial value doesn't pin the type (e.g. `ref<Location[]>([])`
or a ref that starts `null`); otherwise let inference do it.

## 16. Naming conventions

Consistent names make the codebase scannable. The casing rules below are the TypeScript community norm;
most map cleanly from Java, with a few deltas called out at the end.

| Kind | Case | Example |
|------|------|---------|
| Variables, parameters, object properties | `camelCase` | `currentTemp`, `fetchedAt` |
| Functions & methods | `camelCase`, verb-first | `getForecast`, `mapLocation`, `formatTime` |
| Types, interfaces, classes, enums | `PascalCase` | `Location`, `Forecast`, `WeatherView` |
| Enum members | `PascalCase` | `WeatherView.Hourly` |
| Module-level true constants | `UPPER_SNAKE_CASE` | `MAX_LOCATIONS`, `DEFAULT_REFRESH_MS` |
| Generic type parameters | `PascalCase`, descriptive | `TItem`, `TResponse` (or `T` when obvious) |
| Vue components | `PascalCase` | `LocationCard.vue` |
| Files (non-component) | see `CLAUDE.md` | `weatherApi.ts`, `useWeatherStore.ts` |

**Rules & nuances:**

- **`camelCase` for values, `PascalCase` for types.** Familiar from Java — the difference is that TS puts
  *interfaces* in `PascalCase` too, with no `I` prefix (§2).
- **Constants:** reserve `UPPER_SNAKE_CASE` for genuine fixed constants (config, magic numbers lifted to a
  name), like Java `static final`. A `const` that merely holds a local value stays `camelCase` —
  `const url = ...`, not `URL`. So `const MAX_LOCATIONS = 8`, but `const forecast = await getForecast(loc)`.
- **Booleans read like yes/no questions:** prefix with `is` / `has` / `should` / `can` — `isLoading`,
  `hasData`, `shouldRefresh`. Avoid negatives (`isNotReady` → prefer `isReady`).
- **Functions are verb-first:** `getForecast`, `buildUrl`, `mapCurrent`, `removeLocation`. Unlike Java
  beans, idiomatic TS reads plain properties without a `get` prefix (`loc.name`, not `loc.getName()`) — but
  functions that *do work* still start with a verb.
- **No Hungarian / type prefixes:** no `I` on interfaces, no `T` on type aliases, no `str`/`arr` prefixes.
  The type system already tells you the type.
- **Avoid cryptic abbreviations.** `temperature` over `tmp`, `index` over `idx` (a short-lived loop `i` in
  a tiny scope is fine). Names are documentation.
- **Composables & stores** follow `CLAUDE.md`: `useX` (`useAutoRefresh`) and `useXStore`
  (`useWeatherStore`). The `use` prefix is the Vue signal for "reactive/stateful hook."
- **Emit event names** are verb-based and `kebab-case` at the call/handler site — `emit('remove', id)`
  handled as `@remove`.

**Java → TS naming deltas:**

- Interfaces: Java's `IFoo` / `FooImpl` → plain `Foo` in TS (structural typing, §0).
- Getters: Java `getName()` / `isActive()` → read the property directly in TS (`name`, `active`); only
  functions that compute or fetch keep a verb.
- Constants: Java `static final MAX` (`UPPER_SNAKE`) → identical in TS for true constants.
- Packages/classes → files: `camelCase.ts` for modules, `PascalCase.vue` for components.

## Java → TypeScript quick reference

| Java | TypeScript |
|------|------------|
| `interface`/class shape | `interface` (structural, no `implements` needed) |
| `enum Color { RED }` | `type Color = "red" \| "green"` (union, preferred) |
| `null` | `undefined` (default absence); `null` only for "explicitly empty" |
| `Optional<T>` | `T \| undefined`, with `?.` and `??` |
| `Objects.requireNonNull` / null checks | strict null checks do it at compile time |
| `List<T>` | `T[]` or `Array<T>` |
| `Map<K,V>` | `Record<K,V>` (object) or `Map<K,V>` (real Map) |
| `sealed interface` + pattern switch | discriminated union + `switch` on discriminant |
| generics `<T>` | generics `<T>` (near-identical) |
| `final` | `const` (vars), `readonly` (fields) |
| `==` (reference) / `.equals` | `===` (value for primitives) — always use `===` |
| `CompletableFuture<T>` | `Promise<T>` + `async`/`await` |
| package-private / `private` | not exported from the module |
