import { createApp } from 'vue'
// 本地引用 Noto Sans SC 字体 (300, 400, 500, 600, 700)
import '@fontsource/noto-sans-sc/300.css'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/600.css'
import '@fontsource/noto-sans-sc/700.css'
import './style.css'
// 讲义渲染样式（TypstDoc 的样式已从组件里抽出，卡片文案也在其中）
import './styles/MakiTheme.css'
import App from './App.vue'
import router from './router'
import globalComponents from './components'

const app = createApp(App)
app.use(router)
app.use(globalComponents)
app.mount('#app')
