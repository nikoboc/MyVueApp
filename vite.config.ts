import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * 配信先に応じた base パスを決める。
 *
 * GitHub Pages はリポジトリ名のサブパス（`https://<user>.github.io/<repo>/`）で配信
 * するため、生成される URL の先頭にそのパスが必要になる。GitHub Actions は
 * `GITHUB_REPOSITORY` を `owner/repo` の形式で自動的に渡すので、そこから導出する。
 * リポジトリ名をここに書き込まないのは、名前を変えたときの修正漏れを避けるためで
 * ある。
 *
 * @returns base パス。ローカルでの実行時は "/"
 */
function resolveBase(): string {
  const repository = process.env.GITHUB_REPOSITORY
  if (repository === undefined) {
    return '/'
  }
  const name = repository.split('/')[1]
  return name === undefined || name.length < 1 ? '/' : `/${name}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBase(),
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
