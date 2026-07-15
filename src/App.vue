<script setup lang="ts">
import { useCounterStore } from '@/stores/useCounterStore'

// Grab the store instance. We read its fields directly in the template
// (e.g. `counter.count`) so Vue tracks the dependency and re-renders on change.
// Do NOT destructure (`const { count } = counter`) — that breaks reactivity;
// reach for `storeToRefs` if you ever need standalone refs.
const counter = useCounterStore()
</script>

<template>
  <main class="app">
    <header>
      <h1>WeatherBoard</h1>
      <p class="subtitle">Phase 0 — reactivity smoke test (throwaway)</p>
    </header>

    <section class="card">
      <p>Count: <strong>{{ counter.count }}</strong></p>
      <p>Doubled (computed getter): <strong>{{ counter.doubled }}</strong></p>

      <div class="actions">
        <button type="button" @click="counter.increment()">Increment</button>
        <button type="button" @click="counter.reset()">Reset</button>
      </div>

      <p v-if="0 < counter.count" class="hint">
        The view updated itself — you never touched the DOM. That's reactivity.
      </p>
    </section>
  </main>
</template>

<style scoped>
.app {
  max-width: 40rem;
  margin: 4rem auto;
  padding: 0 1.5rem;
}
.subtitle {
  color: gray;
  margin-top: -0.5rem;
}
.card {
  border: 1px solid rgba(128, 128, 128, 0.3);
  border-radius: 0.75rem;
  padding: 1.5rem;
}
.actions {
  display: flex;
  gap: 0.75rem;
  margin: 1rem 0;
}
button {
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid rgba(128, 128, 128, 0.4);
  cursor: pointer;
  font-size: 1rem;
}
.hint {
  color: seagreen;
  font-size: 0.9rem;
}
</style>
