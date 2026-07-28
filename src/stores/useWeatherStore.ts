import { defineStore } from 'pinia'
import { ref } from 'vue'

import { geocode, getForecast } from '@/services/weatherApi'
import type { Forecast, Location } from '@/types/weather'

/**
 * ダッシュボードの中心となるストア。登録された地点と、その予報を保持する。
 * 状態はここに集約され、コンポーネントはここから参照し、ここのアクションを
 * 起動する。天気サービスを呼び出すのもストアのみである
 * （CLAUDE.md のアーキテクチャ規約）。詳細は docs/03-state-and-data.md を参照。
 */
export const useWeatherStore = defineStore('weather', () => {
  // --- state（状態） ---

  /** ユーザーが追加した地点。表示順のまま保持する。 */
  const locations = ref<Location[]>([])

  /** 予報。`Location.id` をキーとするマップ。 */
  const forecasts = ref<Record<string, Forecast>>({})

  /** 予報を取得中の地点の id。 */
  const loadingIds = ref<Set<string>>(new Set())

  /** 直近のエラーメッセージ。直前の操作が成功した場合は `null`。 */
  const error = ref<string | null>(null)

  // --- actions（アクション） ---

  /**
   * 都市名に一致する地点を検索する。`error` の更新以外に状態は変更せず、候補を
   * 呼び出し側へ返すのみとする。API 呼び出しをストア内に閉じ込めるためである
   * （CLAUDE.md 規約 3）。
   *
   * @param query - 都市名（フリーテキスト）
   * @returns 一致した地点。該当が無い場合および失敗時は空配列
   */
  async function searchLocations(query: string): Promise<Location[]> {
    error.value = null
    try {
      return await geocode(query)
    } catch (e) {
      error.value = e instanceof Error ? e.message : '検索に失敗しました'
      return []
    }
  }

  /**
   * 地点を追加し、その予報を取得する。登録済みの場合は何も行わない。
   *
   * @param loc - 追加する地点
   */
  async function addLocation(loc: Location): Promise<void> {
    // 重複チェックは `forecasts` ではなく `locations` を参照する。取得に失敗した
    // 地点および取得中の地点は `forecasts` にエントリーを持たないため、
    // `forecasts` を基準にすると同一の都市を二重に追加できてしまう。その結果
    // `v-for` のキーが重複し、カードが 2 枚描画される。画面に描画されるのは
    // `locations` であるため、チェック対象も `locations` とする。
    if (locations.value.some((l) => l.id === loc.id)) {
      return
    }
    locations.value.push(loc)
    await refreshLocation(loc.id)
  }

  /**
   * 登録済みの地点 1 件について、予報を再取得する。
   *
   * @param id - 更新対象の `Location.id`
   */
  async function refreshLocation(id: string): Promise<void> {
    const loc = locations.value.find((l) => l.id === id)
    if (!loc) {
      return
    }
    loadingIds.value.add(id)
    error.value = null
    try {
      forecasts.value[id] = await getForecast(loc)
    } catch (e) {
      error.value = e instanceof Error ? e.message : `${loc.name}の読み込みに失敗しました`
    } finally {
      loadingIds.value.delete(id)
    }
  }

  /**
   * 地点とその予報をダッシュボードから削除する。
   *
   * @param id - 削除対象の `Location.id`
   */
  function removeLocation(id: string): void {
    locations.value = locations.value.filter((l) => l.id !== id)
    delete forecasts.value[id]
  }

  /** 登録されているすべての地点の予報を並列で再取得する。 */
  async function refreshAll(): Promise<void> {
    await Promise.all(locations.value.map((l) => refreshLocation(l.id)))
  }

  return {
    locations,
    forecasts,
    loadingIds,
    error,
    searchLocations,
    addLocation,
    refreshLocation,
    removeLocation,
    refreshAll,
  }
})
