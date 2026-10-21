import { createApp } from 'vue'
// 本地引用 Noto Sans SC 字体 (300, 400, 500, 600, 700)
import '@fontsource/noto-sans-sc/300.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
import './style.css'
// 讲义专属预设样式
import './presets/styles/maki-kaoyan.css'
import App from './App.vue'
import router from './router'
import globalComponents from './components'

const app = createApp(App)
app.use(router)
app.use(globalComponents)
app.mount('#app')
