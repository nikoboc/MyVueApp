import type { PunchIssue, PunchType, WorkStatus } from '@/types/attendance'

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
