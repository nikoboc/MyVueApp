<script setup lang="ts">
import { ref } from 'vue'

import BaseSpinner from '@/components/BaseSpinner.vue'
import { useWeatherStore } from '@/stores/useWeatherStore'
import type { Location } from '@/types/weather'

/**
 * Search box + geocoding results dropdown.
 *
 * Its job is "help the user pick a place" — nothing more. It asks the store to
 * *find* candidates, but it does not decide what happens to the one the user
 * picks: it emits `select` and lets the parent own that ("events up",
 * CLAUDE.md rule 2). Searching reads; adding mutates, and the component that
 * owns the dashboard should own the mutation.
 */
const emit = defineEmits<{ (e: 'select', location: Location): void }>()

const store = useWeatherStore()

// Ephemeral UI state — only this component cares what's half-typed in the box
// or which candidates are on screen, so it stays local rather than in Pinia
// (CLAUDE.md rule 1 allows exactly this).
const query = ref('')
const matches = ref<Location[]>([])
const isSearching = ref(false)
const hasSearched = ref(false)

/**
 * Runs the geocoding search for the typed query.
 *
 * Searching on submit rather than on every keystroke keeps us off the free API's
 * rate limits; debounced live search needs `watch`, which is a later phase.
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
    // `finally` so a thrown error can't leave the spinner stuck on forever.
    isSearching.value = false
  }
}

/**
 * Hands the picked location to the parent and resets the dropdown.
 *
 * @param location - the candidate the user clicked
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
    <!-- `v-model` is two-way binding: it wires the input's value to `query` and
         writes changes back. Sugar for :value + @input. `.prevent` stops the
         browser's native form submit (a full page reload). -->
    <form @submit.prevent="search">
      <input v-model="query" type="search" placeholder="Search a city, e.g. Berlin" aria-label="City name" />
      <button type="submit" :disabled="isSearching">Search</button>
    </form>

    <BaseSpinner v-if="isSearching" label="Searching…" />

    <!-- `:key` gives Vue a stable identity per row so it patches the existing
         DOM instead of rebuilding the list. Location.id is "lat,lon" — unique
         even when two cities share a name. -->
    <ul v-else-if="0 < matches.length" class="results">
      <li v-for="location in matches" :key="location.id">
        <button type="button" @click="select(location)">
          <span>{{ location.name }}</span>
          <span class="country">{{ location.country }}</span>
        </button>
      </li>
    </ul>

    <!-- Only claim "no matches" when the search actually succeeded — on failure
         the store sets `error` and App shows it, and both at once would lie. -->
    <p v-else-if="hasSearched && !store.error" class="no-results">No matches for “{{ query }}”.</p>
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
