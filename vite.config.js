import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// 本地开发代理目标
const API_TARGET = process.env.VITE_API_TARGET || 'http://127.0.0.1:3000'

// 仅保留 KaTeX 的 woff2 字体，剔除面向旧浏览器的冗余 ttf 与 woff
function katexWoff2Plugin() {
  return {
    name: 'katex-woff2-only',
    transform(code, id) {
      if (id.includes('katex') && id.endsWith('.css')) {
        return {
          code: code.replace(/,url\([^)]+?\.(?:woff|ttf)\) format\([^)]+?\)/g, ''),
          map: null
        }
      }
    }
  }
}

export default defineConfig({
  plugins: [
    vue(),
    katexWoff2Plugin()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 将工作台专用的 monaco 独立分包，避免污染前台读者的主包体积
          if (id.includes('monaco-editor')) {
            return 'monaco-vendor'
          }
          if (id.includes('katex')) {
            return 'katex-vendor'
          }
        }
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true
      }
    }
  }
})
