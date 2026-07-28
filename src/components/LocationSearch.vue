<script setup lang="ts">
import { ref } from 'vue'

import BaseSpinner from '@/components/BaseSpinner.vue'
import { useWeatherStore } from '@/stores/useWeatherStore'
import type { Location } from '@/types/weather'

/**
 * 検索ボックスと、ジオコーディング結果のドロップダウン。
 *
 * このコンポーネントが担当するのは、ユーザーが地点を選択するまでである。候補の
 * 検索はストアへ委譲するが、選択された地点をその後どう扱うかは決定しない。
 * `select` を emit し、判断は親に委ねる（events up。CLAUDE.md 規約 2）。検索は
 * 読み取りであるのに対し追加は状態の変更であり、ダッシュボードを管理する
 * コンポーネントが担当すべきものだからである。
 */
const emit = defineEmits<{ (e: 'select', location: Location): void }>()

const store = useWeatherStore()

// 一時的な UI 状態。入力途中の文字列および表示中の候補を必要とするのはこの
// コンポーネントのみであるため、Pinia ではなくローカルに保持する。CLAUDE.md
// 規約 1 が例外として認めているのがこのケースである。
const query = ref('')
const matches = ref<Location[]>([])
const isSearching = ref(false)
const hasSearched = ref(false)

/**
 * 入力された文字列でジオコーディング検索を実行する。
 *
 * キー入力のたびではなく送信時に検索することで、無料 API のレート制限を回避して
 * いる。入力に追随する検索の実装には `watch` を要するが、これは後のフェーズで扱う。
 */
async function search(): Promise<void> {
  if (query.value.trim().length < 1) {
    return
  }
  isSearching.value = true
  try {
    matches.value = await store.searchLocations(query.value)
    hasSearched.value = true
  } finally {
    // `finally` に配置することで、例外が発生してもスピナーが残り続けない。
    isSearching.value = false
  }
}

/**
 * 選択された地点を親へ渡し、ドロップダウンをリセットする。
 *
 * @param location - ユーザーがクリックした候補
 */
function select(location: Location): void {
  emit('select', location)
  query.value = ''
  matches.value = []
  hasSearched.value = false
}
</script>

<template>
  <div class="search">
    <!-- `v-model` は双方向バインディングであり、input の値を `query` に結び付け、
         変更を書き戻す。:value と @input を組み合わせた記法の糖衣構文にあたる。
         `.prevent` はブラウザ標準のフォーム送信（ページ全体のリロード）を抑止する。 -->
    <form @submit.prevent="search">
      <!-- 例をローマ字としているのは表記上の選好ではなく、API の制約による。
           Open-Meteo のジオコーディングでは、日本の都市を漢字で検索できない
           （weatherApi.ts の GEOCODING_LANGUAGE のコメントを参照）。 -->
      <input
        v-model="query"
        type="search"
        placeholder="都市名をローマ字で検索（例：Tokyo）"
        aria-label="都市名（ローマ字）"
      />
      <button type="submit" :disabled="isSearching">検索</button>
    </form>

    <BaseSpinner v-if="isSearching" label="検索中…" />

    <!-- `:key` で各行に一意な識別子を与えることで、Vue はリストを再生成せず
         既存の DOM を差分更新できる。Location.id は「緯度,経度」であるため、
         同名の都市が存在しても重複しない。 -->
    <ul v-else-if="0 < matches.length" class="results">
      <li v-for="location in matches" :key="location.id">
        <button type="button" @click="select(location)">
          <span>{{ location.name }}</span>
          <span class="country">{{ location.country }}</span>
        </button>
      </li>
    </ul>

    <!-- 「該当なし」を表示するのは検索が成功した場合に限る。失敗時はストアが
         `error` を設定し App がそれを表示するため、両方を同時に表示すると
         誤った案内となる。 -->
    <p v-else-if="hasSearched && !store.error" class="no-results">
      「{{ query }}」に一致する地点はありませんでした。
    </p>
  </div>
</template>

<style scoped>
.search {
  position: relative;
}
form {
  display: flex;
  gap: 0.5rem;
}
input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  font-size: 1rem;
}
form button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
}
form button:disabled {
  opacity: 0.5;
  cursor: default;
}
.results {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.5rem;
  overflow: hidden;
}
.results button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.75rem;
  border: 0;
  background: transparent;
  cursor: pointer;
  font-size: 1rem;
  text-align: left;
  color: inherit;
}
.results button:hover,
.results button:focus-visible {
  background: rgba(128, 128, 128, 0.15);
}
.country {
  color: gray;
  font-size: 0.85rem;
}
.no-results {
  margin: 0.5rem 0 0;
  color: gray;
}
</style>
