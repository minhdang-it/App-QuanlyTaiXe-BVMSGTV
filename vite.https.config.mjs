import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const keyValue = process.env.LOCAL_HTTPS_KEY || env.LOCAL_HTTPS_KEY || '.certs/local-key.pem'
  const certValue = process.env.LOCAL_HTTPS_CERT || env.LOCAL_HTTPS_CERT || '.certs/local-cert.pem'
  const keyPath = resolve(process.cwd(), keyValue)
  const certPath = resolve(process.cwd(), certValue)
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    throw new Error(`Thiếu chứng chỉ HTTPS local: ${keyPath} / ${certPath}`)
  }
  return {
    base: '/',
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5173,
      https: { key: readFileSync(keyPath), cert: readFileSync(certPath) },
      proxy: { '/api/navicom': { target: 'http://127.0.0.1:3020', changeOrigin: true, rewrite: (path) => path.replace(/^\/api\/navicom/, '') } },
    },
    build: { target: 'es2022', sourcemap: false, cssMinify: false },
  }
})
