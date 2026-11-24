import basicSsl from '@vitejs/plugin-basic-ssl';
import vue from '@vitejs/plugin-vue';
import { defineConfig, loadEnv } from 'vite';

// 本地开发代理目标配置
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget =
    env.VITE_API_TARGET ||
    process.env.VITE_API_TARGET ||
    (mode === 'remote' ? 'https://maki-math.com' : 'http://127.0.0.1:3000');

  return {
    plugins: [vue(), basicSsl()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes('node_modules/vue') ||
              id.includes('node_modules/vue-router') ||
              id.includes('node_modules/@vue')
            ) {
              return 'vue-vendor';
            }
          }
        }
      }
    },
    server: {
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
