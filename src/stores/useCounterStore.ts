import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Throwaway counter store for Phase 0. Exists only to prove the
 * Vue + Pinia + TypeScript stack is wired end-to-end, and to demonstrate the
 * three parts of a setup-style store: state, a getter, and actions.
 *
 * Replaced by the real weather store in Phase 2 (see docs/03-state-and-data.md).
 */
export const useCounterStore = defineStore('counter', () => {
  /** State: the current count. `ref` is what makes it reactive. */
  const count = ref(0)

  /** Getter: a derived, cached value — recomputes only when `count` changes. */
  const doubled = computed(() => count.value * 2)

  /** Increment the counter by one. */
  function increment(): void {
    count.value++
  }

  /** Reset the counter back to zero. */
  function reset(): void {
    count.value = 0
  }

  return { count, doubled, increment, reset }
})
