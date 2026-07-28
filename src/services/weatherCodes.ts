/**
 * WMO 天気コードの変換テーブル。Open-Meteo は天気を数値の WMO コードで返す
 * （https://open-meteo.com/en/docs）ため、表示可能な表現へ変換する。
 * `services/` 配下の他のファイルと同様、Vue を含まない純粋な TypeScript である。
 */

/** 天気コード 1 件の UI 上での表現。 */
export interface WeatherDescription {
  readonly label: string
  readonly icon: string
}

/** テーブルに存在しないコードが返された場合の表示。 */
const UNKNOWN_WEATHER: WeatherDescription = { label: '不明', icon: '❓' }

/**
 * WMO コードからラベルとアイコンへの変換表。コードは連番ではなく、系統ごとに
 * 不連続な値をとる（0〜3 が快晴からくもり、45/48 が霧、51〜57 が霧雨、
 * 61〜67 が雨、71〜77 が雪、80〜86 がにわか雨とにわか雪、95〜99 が雷雨）。
 * そのため配列ではなく、キー付きのマップとしている。
 */
const WEATHER_CODES: Record<number, WeatherDescription> = {
  0: { label: '快晴', icon: '☀️' },
  1: { label: 'おおむね晴れ', icon: '🌤️' },
  2: { label: '一部くもり', icon: '⛅' },
  3: { label: 'くもり', icon: '☁️' },
  45: { label: '霧', icon: '🌫️' },
  48: { label: '着氷性の霧', icon: '🌫️' },
  51: { label: '弱い霧雨', icon: '🌦️' },
  53: { label: '霧雨', icon: '🌦️' },
  55: { label: '強い霧雨', icon: '🌦️' },
  56: { label: '弱い着氷性の霧雨', icon: '🌧️' },
  57: { label: '強い着氷性の霧雨', icon: '🌧️' },
  61: { label: '弱い雨', icon: '🌧️' },
  63: { label: '雨', icon: '🌧️' },
  65: { label: '強い雨', icon: '🌧️' },
  66: { label: '弱い着氷性の雨', icon: '🌧️' },
  67: { label: '強い着氷性の雨', icon: '🌧️' },
  71: { label: '弱い雪', icon: '🌨️' },
  73: { label: '雪', icon: '🌨️' },
  75: { label: '強い雪', icon: '❄️' },
  77: { label: '霧雪', icon: '🌨️' },
  80: { label: '弱いにわか雨', icon: '🌦️' },
  81: { label: 'にわか雨', icon: '🌦️' },
  82: { label: '激しいにわか雨', icon: '⛈️' },
  85: { label: '弱いにわか雪', icon: '🌨️' },
  86: { label: '強いにわか雪', icon: '❄️' },
  95: { label: '雷雨', icon: '⛈️' },
  96: { label: '雷雨（弱いひょう）', icon: '⛈️' },
  99: { label: '雷雨（強いひょう）', icon: '⛈️' },
}

/**
 * WMO 天気コードを表示用の説明へ変換する。
 *
 * @param code - API から返された WMO コード
 * @returns 対応するラベルとアイコン。未定義のコードの場合は「不明」を返す
 */
export function describeWeather(code: number): WeatherDescription {
  // `noUncheckedIndexedAccess`（docs/05 §1）が有効であるため、この参照の型は
  // `WeatherDescription | undefined` となる。したがって `??` は防御的な記述では
  // なく、コンパイラが要求するものである。実際、WMO にはここで扱っていない
  // コードも存在する。
  return WEATHER_CODES[code] ?? UNKNOWN_WEATHER
}
