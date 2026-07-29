import { createRouter, createWebHashHistory, type Router } from 'vue-router'

import MonthlyView from '@/views/MonthlyView.vue'
import PunchView from '@/views/PunchView.vue'

/**
 * 画面遷移の定義。
 *
 * ハッシュモード（`#/monthly` のような URL）を用いる。履歴モードでは
 * `/MyVueApp/monthly` のようなパスがサーバーへ届くが、GitHub Pages にはその名前の
 * ファイルが無いため 404 になる。ハッシュより後ろはサーバーに送られないため、
 * 配信側の設定を変えずに済み、オフラインでも同じように動作する。
 *
 * 月次集計の月を URL に含めているのは、特定の月をブックマークしたり共有したり
 * できるようにするためである。省略時は当月を表示する。
 */
export const router: Router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'punch', component: PunchView },
    { path: '/monthly/:month?', name: 'monthly', component: MonthlyView },
    // 定義のないパスは打刻画面へ戻す。古いブックマークで空白の画面を見せない。
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})
