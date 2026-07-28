<script setup lang="ts">
// 再利用可能な部品であるため `Base` を接頭辞としている（CLAUDE.md の命名規約）。
// 天気にもストアにも依存しない。
//
// `withDefaults` は省略可能な prop にデフォルト値を設定する。結果を変数へ代入
// していないのは、`<script setup>` ではテンプレートから prop を名前で直接参照
// できるためであり、変数で受けると `noUnusedLocals` に抵触する。
withDefaults(defineProps<{ label?: string }>(), { label: '読み込み中…' })
</script>

<template>
  <!-- スクリーンリーダーはアニメーションを認識できないため、role="status" と
       aria-label で待機中であることを伝える。視覚表現は装飾であり、情報は
       label 側に保持する。 -->
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

/* 視差効果を減らす設定が有効な場合は、回転ではなくフェードで表現する。 */
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
