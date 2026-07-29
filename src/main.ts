import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'
import { router } from '@/router'

// mount より先に Pinia とルーターを install する。これによりすべてのコンポーネント
// から、ストアと画面遷移を参照できるようになる。
createApp(App).use(createPinia()).use(router).mount('#app')

// Service Worker を登録し、通信できない場所でも打刻できるようにする。
//
// 開発時は登録しない。キャッシュが効くと、コードを変更しても古い画面が表示され
// 続けることがあるためである。
//
// `BASE_URL` を前置するのは、GitHub Pages のようにサブパスで配信される場合に
// 対応するためである。Service Worker が管理する範囲は自身が置かれた階層以下に
// なるので、この位置を誤ると登録できても何も制御できない。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
  })
}
