import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      // "@/..." を "src/..." へ解決する。docs/05 §10（モジュールと import）を参照。
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // スマートフォンからの動作確認のため、Cloudflare のクイックトンネル
    // （*.trycloudflare.com）経由での開発サーバー公開を許可する。開発時のみ。
    allowedHosts: ['.trycloudflare.com'],
  },
})
