import { createApp } from 'vue'
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
