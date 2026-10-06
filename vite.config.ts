import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/api/navicom': { target: 'http://127.0.0.1:3020', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/navicom/, '') } } },
  preview: { host: '0.0.0.0', port: 4173 },
  build: {
    target: 'es2022',
    sourcemap: false,
    cssMinify: false,
  },
})
