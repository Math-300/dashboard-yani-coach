import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Cargar variables de entorno desde .env.local y .env
  const env = loadEnv(mode, '.', ['VITE_', '']);

  console.log('[Vite Config] Token cargado:', env.VITE_NOCODB_TOKEN ? 'SÍ' : 'NO');
  console.log('[Vite Config] URL:', env.VITE_NOCODB_URL);

  return {
    server: {
      port: 5000,
      host: '0.0.0.0',
      proxy: {
        '/api/nocodb': {
          target: env.VITE_NOCODB_URL || 'https://app.nocodb.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/nocodb/, '/api/v2/tables'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              const token = env.VITE_NOCODB_TOKEN;
              if (token) {
                proxyReq.setHeader('xc-token', token);
                console.log('[Proxy] xc-token set: SÍ');
              } else {
                console.warn('[Proxy] xc-token set: NO (VITE_NOCODB_TOKEN vacío)');
              }
            });
            proxy.on('error', (err) => {
              console.error('[Proxy Error]', err);
            });
          }
        }
      }
    },
    plugins: [
      react()
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
