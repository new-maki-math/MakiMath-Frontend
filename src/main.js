import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import globalComponents from './components'
import { setupDevToolsWarning } from './utils/security-warning.js'
import { commandServiceKey, createCommandService, installConsoleCommands } from './commands/index.js'

setupDevToolsWarning()

const app = createApp(App)
const commandService = createCommandService()
app.provide(commandServiceKey, commandService)
installConsoleCommands(commandService)
app.use(router)
app.use(globalComponents)
app.mount('#app')
