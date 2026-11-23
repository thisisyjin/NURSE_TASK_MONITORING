import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const f2Upstream = 'http://192.168.45.149:3001'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/f2-api': {
          target: f2Upstream,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/f2-api/, ''),
          configure: (proxy) => {
            const server = proxy as unknown as {
              on: (
                event: 'proxyReq',
                listener: (proxyReq: { getHeader: (name: string) => unknown; setHeader: (name: string, value: string) => void }) => void,
              ) => void
            }
            server.on('proxyReq', (proxyReq) => {
              if (!env.F2_API_KEY || proxyReq.getHeader('x-api-key')) return
              proxyReq.setHeader('x-api-key', env.F2_API_KEY)
            })
          },
        },
      },
    },
    test: {
      environment: 'node',
      globals: true,
    },
  }
})
