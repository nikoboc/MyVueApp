<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'

// App は全体の枠だけを持ち、画面の中身は RouterView が差し替える。状態はストアが
// 保持し、描画は各画面のコンポーネントが担当する。
</script>

<template>
  <main class="app">
    <header>
      <h1>TimeCard</h1>
      <p class="subtitle">勤怠打刻</p>
    </header>

    <!-- RouterLink は現在の画面に router-link-active を付けるため、選択中の
         表示を自前で管理しなくてよい。 -->
    <nav>
      <RouterLink to="/">打刻</RouterLink>
      <RouterLink to="/monthly">月次集計</RouterLink>
    </nav>

    <RouterView />
  </main>
</template>

<style scoped>
.app {
  max-width: 44rem;
  margin: 3rem auto;
  padding: 0 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}
header {
  margin-bottom: -0.5rem;
}
h1 {
  margin: 0;
}
.subtitle {
  margin: 0.25rem 0 0;
  color: gray;
}
nav {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.25);
}
nav a {
  padding: 0.6rem 1rem;
  color: gray;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
nav a:hover,
nav a:focus-visible {
  color: inherit;
}
nav a.router-link-active {
  color: seagreen;
  border-bottom-color: seagreen;
  font-weight: 600;
}

@media (pointer: coarse) {
  nav a {
    min-height: 44px;
    display: flex;
    align-items: center;
  }
}
</style>
