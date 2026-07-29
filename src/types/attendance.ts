/**
 * 勤怠打刻のドメインモデル。本アプリケーション固有の型であり、保存層および
 * 集計処理はこの形式を介してやり取りする。Vue を含まない純粋な TypeScript。
 *
 * 保存されるのは打刻の列だけである。1 日の勤務時間や状態はそこから導出する
 * （docs/03-state-and-data.md）。導出値を保存しないため、打刻を修正すれば集計は
 * 常に追随し、両者が食い違うことがない。
 */

/**
 * 打刻の種別。実行時にも値の一覧が必要なため `as const` の配列から型を導出する
 * （docs/05 §3）。
 */
export const PUNCH_TYPES = ['clock-in', 'break-start', 'break-end', 'clock-out'] as const

export type PunchType = (typeof PUNCH_TYPES)[number]

/** 1 回の打刻。 */
export interface Punch {
  readonly id: string
  readonly type: PunchType
  /**
   * 打刻時刻。ローカル時刻の "YYYY-MM-DDTHH:mm" 形式で保持する。タイムゾーン
   * 情報を持たせないのは、勤怠が壁時計の時刻で運用されるためである。
   */
  readonly at: string
}

/** 勤務状態。打刻列を時刻順にたどって決まる。 */
export type WorkStatus = 'before-work' | 'working' | 'on-break' | 'after-work'

/**
 * 打刻の不整合。判別可能なユニオンとすることで、表示側の分岐をコンパイラが
 * 網羅的に検査できる（docs/05 §7）。
 */
export type PunchIssue =
  | { readonly kind: 'unclosed-work' }
  | { readonly kind: 'unclosed-break' }
  | { readonly kind: 'orphan-clock-out' }
  | { readonly kind: 'orphan-break-end' }

/** 1 日分の集計。すべて打刻列から導出される。 */
export interface DaySummary {
  /** 日付キー "YYYY-MM-DD"。 */
  readonly date: string
  /** その日の打刻を時刻順に並べたもの。 */
  readonly punches: readonly Punch[]
  /** 在社時間。出勤から退勤までの合計。 */
  readonly presentMs: number
  /** 休憩時間の合計。 */
  readonly breakMs: number
  /** 実働時間。在社時間から休憩時間を引いたもの。 */
  readonly workedMs: number
  readonly status: WorkStatus
  /**
   * 継続中の勤務または休憩が始まった打刻時刻。区切られていない区間が無い場合は
   * `undefined`。経過時間の実時間表示に用いる。
   */
  readonly openSince: string | undefined
  readonly issues: readonly PunchIssue[]
}

/** 1 か月分の集計。日ごとの集計をさらに合算したもの。 */
export interface MonthSummary {
  /** 月キー "YYYY-MM"。 */
  readonly month: string
  /** その月の、打刻がある日の集計。日付の昇順。 */
  readonly days: readonly DaySummary[]
  readonly presentMs: number
  readonly breakMs: number
  readonly workedMs: number
  /** 打刻がある日の数。 */
  readonly dayCount: number
  /** 不整合が検出された日の数。 */
  readonly issueDayCount: number
  /** 1 日あたりの平均実働時間。打刻がある日が無い場合は 0。 */
  readonly averageWorkedMs: number
}
