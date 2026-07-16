<script setup lang="ts">
// A reusable primitive — hence the `Base` prefix (CLAUDE.md naming). It knows
// nothing about weather or the store; it just spins.
//
// `withDefaults` supplies a default for the optional prop. Note we don't assign
// the result to a variable: in `<script setup>` the template can read props by
// name directly, and `noUnusedLocals` would flag an unused binding.
withDefaults(defineProps<{ label?: string }>(), { label: 'Loading…' })
</script>

<template>
  <!-- role="status" + aria-label announce the wait to screen readers, which see
       no animation. The visual is decorative, so the text lives in the label. -->
  <span class="spinner" role="status" :aria-label="label" />
</template>

<style scoped>
.spinner {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(128, 128, 128, 0.3);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Respect users who ask for reduced motion: fade instead of spin. */
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
}
</style>
