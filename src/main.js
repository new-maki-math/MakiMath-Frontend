import './style.css';

import { createApp } from 'vue';

import App from './App.vue';
import {
  commandServiceKey,
  createCommandService,
  installConsoleCommands
} from './commands/index.js';
import router from './router/index.js';
import { printSecurityWarning } from './utils/security-warning.js';

printSecurityWarning();

const app = createApp(App);
const commandService = createCommandService();
app.provide(commandServiceKey, commandService);
installConsoleCommands(commandService);
app.use(router);
app.mount('#app');
