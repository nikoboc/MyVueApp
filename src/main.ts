import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'

// mount より先に Pinia を install する。これによりすべてのコンポーネントから
// ストアを参照できるようになる。
createApp(App).use(createPinia()).mount('#app')
