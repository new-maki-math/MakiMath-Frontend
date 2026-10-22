import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 本地开发代理目标
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:3000'

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
