import { createApp } from 'vue'
// 引入中文字体
import '@fontsource/noto-sans-sc/300.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
import 'typlet/fonts/typlet.css'
import './style.css'
import App from './App.vue'
import router from './router'
import globalComponents from './components'
import { setupDevToolsWarning } from './utils/security-warning.js'

setupDevToolsWarning()

const app = createApp(App)
app.use(router)
app.use(globalComponents)
app.mount('#app')
