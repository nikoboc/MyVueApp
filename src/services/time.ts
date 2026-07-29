/**
 * 日時の解析と整形。Vue を含まない純粋な TypeScript であり、単体テストできる。
 *
 * 打刻はローカル時刻の "YYYY-MM-DDTHH:mm" 形式で扱う。`Date` の ISO 文字列を
 * そのまま使わないのは、タイムゾーンの変換が入ると壁時計の時刻がずれるため
 * である。勤怠では「9:02 に出勤した」という表示上の時刻がそのまま記録であり、
 * UTC への変換は不要な複雑さを持ち込む。
 */

const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** 曜日の表示。`Date.getDay()` の戻り値を添字とする。 */
const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const

/**
 * 数値を 2 桁の 0 埋め文字列にする。
 *
 * @param value - 0 以上の整数
 * @returns "09" のような 2 桁の文字列
 */
function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * 文字列が打刻時刻の形式かどうかを判定する。
 *
 * @param value - 判定する文字列
 * @returns 形式が正しく、実在する日時であれば true
 */
export function isDateTimeString(value: string): boolean {
  return parseDateTime(value) !== undefined
}

/**
 * 打刻時刻をエポックミリ秒へ変換する。
 *
 * 形式が正しくても実在しない日付（"2026-02-31" など）は `Date` が翌月へ繰り上げて
 * しまうため、生成した `Date` から月日を読み戻して一致を確認する。
 *
 * @param value - "YYYY-MM-DDTHH:mm" 形式の文字列
 * @returns エポックミリ秒。形式が不正、または実在しない日時であれば `undefined`
 */
export function parseDateTime(value: string): number | undefined {
  const match = DATE_TIME_PATTERN.exec(value)
  if (match === null) {
    return undefined
  }

  const [, year, month, day, hour, minute] = match
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return undefined
  }

  const monthIndex = Number(month) - 1
  const date = new Date(Number(year), monthIndex, Number(day), Number(hour), Number(minute))
  if (date.getMonth() !== monthIndex || date.getDate() !== Number(day)) {
    return undefined
  }
  if (23 < Number(hour) || 59 < Number(minute)) {
    return undefined
  }
  return date.getTime()
}

/**
 * エポックミリ秒を打刻時刻の形式へ変換する。
 *
 * @param ms - エポックミリ秒
 * @returns "YYYY-MM-DDTHH:mm" 形式の文字列
 */
export function formatDateTime(ms: number): string {
  const date = new Date(ms)
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  return `${datePart}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/**
 * 打刻時刻から日付キーを取り出す。
 *
 * @param value - "YYYY-MM-DDTHH:mm" 形式の文字列
 * @returns "YYYY-MM-DD" 形式の日付キー
 */
export function toDateKey(value: string): string {
  return value.slice(0, 10)
}

/**
 * 現在時刻に対応する日付キーを返す。
 *
 * @param nowMs - 現在時刻（エポックミリ秒）
 * @returns "YYYY-MM-DD" 形式の日付キー
 */
export function todayKey(nowMs: number): string {
  return toDateKey(formatDateTime(nowMs))
}

/**
 * 打刻時刻から時刻部分を取り出す。
 *
 * @param value - "YYYY-MM-DDTHH:mm" 形式の文字列
 * @returns "HH:mm" 形式の文字列
 */
export function toClock(value: string): string {
  return value.slice(11, 16)
}

/**
 * 日付キーと "HH:mm" を打刻時刻の形式に組み立てる。
 *
 * @param date - "YYYY-MM-DD" 形式の日付キー
 * @param clock - "HH:mm" 形式の時刻
 * @returns "YYYY-MM-DDTHH:mm" 形式の文字列
 */
export function toDateTime(date: string, clock: string): string {
  return `${date}T${clock}`
}

/**
 * 経過時間を日本語の表記に整形する。
 *
 * @param ms - 経過時間（ミリ秒）
 * @returns 「8時間15分」「45分」のような文字列
 */
export function formatDuration(ms: number): string {
  const safeMs = Math.max(0, ms)
  const hours = Math.floor(safeMs / HOUR_MS)
  const minutes = Math.floor((safeMs % HOUR_MS) / MINUTE_MS)
  return hours < 1 ? `${minutes}分` : `${hours}時間${minutes}分`
}

/**
 * 日付キーを表示用のラベルに整形する。
 *
 * @param date - "YYYY-MM-DD" 形式の日付キー
 * @returns 「2026年7月29日(水)」のような文字列。解析できない場合は入力をそのまま返す
 */
export function formatDateLabel(date: string): string {
  const ms = parseDateTime(toDateTime(date, '00:00'))
  if (ms === undefined) {
    return date
  }
  const value = new Date(ms)
  const weekday = WEEKDAY_LABELS[value.getDay()] ?? ''
  return `${value.getFullYear()}年${value.getMonth() + 1}月${value.getDate()}日(${weekday})`
}
