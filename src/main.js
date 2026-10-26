import { createApp } from 'vue'
import 'typlet/fonts/typlet.css'
import './style.css'
import App from './App.vue'
import router from './router'
import globalComponents from './components'
import { setupDevToolsWarning } from './utils/security-warning.js'

setupDevToolsWarning()

// 全局移动端禁用双指缩放与手势捏合 (兼容 iOS Safari 10+ 与各类移动端 WebKit)
if (typeof window !== 'undefined') {
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault();
      }
    },
    { passive: false }
  );
}

const app = createApp(App)
app.use(router)
app.use(globalComponents)
app.mount('#app')
