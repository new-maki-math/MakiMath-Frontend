import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 本地开发时 /api 打到本机后端，可用 VITE_API_TARGET 覆盖
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:3000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      },
      '^/c/': {
        target: 'https://maki-math.com',
        changeOrigin: true
      }
    }
  }
})
