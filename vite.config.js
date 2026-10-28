import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import vue from '@vitejs/plugin-vue'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'
import { knowledgeFontPath } from './src/views/knowledge/knowledge-font.js'

const glyphCacheVersion = createHash('sha256')
  .update(readFileSync(new URL(`./public/${knowledgeFontPath}`, import.meta.url)))
  .update(readFileSync(new URL('./src/views/knowledge/knowledge-glyph-worker.js', import.meta.url)))
  .update(readFileSync(new URL('./pnpm-lock.yaml', import.meta.url)))
  .digest('hex')

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
  define: { __KNOWLEDGE_GLYPH_CACHE_VERSION__: JSON.stringify(glyphCacheVersion) },
  plugins: [
    vue(),
    basicSsl(),
    katexWoff2Plugin()
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/vue-router') || id.includes('node_modules/@vue')) {
            return 'vue-vendor';
          }
          if (id.includes('katex')) {
            return 'katex-vendor';
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
