import { defineConfig, mergeConfig } from 'vitest/config'

import viteConfig from './vite.config'

/**
 * テストの設定。
 *
 * ビルドの設定（`vite.config.ts`）を取り込んでから上書きする。こうしておくと
 * `@/` のパスエイリアスが本番と同じ解決になり、テストだけ通ってビルドが壊れる、
 * あるいはその逆が起きない。
 */
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // ブラウザーの API（localStorage、DOM）を使うため jsdom を用いる。
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.ts'],
      // ソースの隣に置いた *.spec.ts を対象とする。実装と並んでいると、
      // どこにテストがあるか探す必要がない。
      include: ['src/**/*.spec.ts'],
      // 各テストの後でモックを元へ戻す。前のテストの細工が残らないようにする。
      restoreMocks: true,
    },
  }),
)
