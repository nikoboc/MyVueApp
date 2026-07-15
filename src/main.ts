import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from '@/App.vue'

// Install Pinia before mounting so every component can reach the stores.
createApp(App).use(createPinia()).mount('#app')
