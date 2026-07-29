import type { DayEntryIssue, PunchIssue, PunchType, WorkStatus } from '@/types/attendance'

/**
 * 打刻の種別・勤務状態・不整合を表示用の文字列へ変換する。`services/` 配下の
 * 他のファイルと同様、Vue を含まない純粋な TypeScript である。
 *
 * 表示文字列をコンポーネントに散らさず 1 か所へ集めることで、文言の変更が
 * 1 ファイルの修正で済む。
 */

/** 打刻の種別の表示名。 */
export const PUNCH_LABELS: Record<PunchType, string> = {
  'clock-in': '出勤',
  'break-start': '休憩開始',
  'break-end': '休憩終了',
  'clock-out': '退勤',
}

/** 勤務状態の表示名。 */
export const STATUS_LABELS: Record<WorkStatus, string> = {
  'before-work': '未出勤',
  working: '勤務中',
  'on-break': '休憩中',
  'after-work': '退勤済み',
}

/**
 * 打刻の不整合を説明文へ変換する。
 *
 * `switch` が判別子をすべて網羅しているため、`PunchIssue` に種類を追加すると
 * 戻り値の型が合わなくなり、コンパイラがこの関数の修正漏れを検出する
 * （docs/05 §7）。
 *
 * @param issue - 検出された不整合
 * @returns 利用者に示す説明文
 */
export function describeIssue(issue: PunchIssue): string {
  switch (issue.kind) {
    case 'unclosed-work':
      return '退勤の打刻がありません'
    case 'unclosed-break':
      return '休憩終了の打刻がありません'
    case 'orphan-clock-out':
      return '対応する出勤がない退勤があります'
    case 'orphan-break-end':
      return '対応する休憩開始がない休憩終了があります'
  }
}

/**
 * 1 日分の入力に対する指摘を説明文へ変換する。
 *
 * `describeIssue` と同じく `switch` が判別子を網羅しているため、種類を追加すると
 * コンパイラがこの関数の修正漏れを検出する。
 *
 * @param issue - 検出された指摘
 * @returns 利用者に示す説明文
 */
export function describeDayEntryIssue(issue: DayEntryIssue): string {
  switch (issue.kind) {
    case 'clock-out-not-after-in':
      return '退勤は出勤より後の時刻にしてください'
    case 'incomplete-break':
      return '休憩は開始と終了の両方を入力してください'
    case 'break-end-not-after-start':
      return '休憩終了は休憩開始より後の時刻にしてください'
    case 'break-outside-work':
      return '休憩は出勤から退勤までの間に収めてください'
  }
}
