import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { sentryVitePlugin } from "@sentry/vite-plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      disable: !process.env.SENTRY_AUTH_TOKEN, // skip in local dev
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts'))              return 'vendor-charts'
            if (id.includes('@tanstack/react-table')) return 'vendor-table'
            if (id.includes('motion'))                return 'vendor-motion'
            if (id.includes('react-virtuoso'))        return 'vendor-virtuoso'
            if (id.includes('lucide-react'))          return 'vendor-icons'
            if (id.includes('react-use-intercom'))    return 'vendor-intercom'
            if (id.includes('react-router'))          return 'vendor-router'
          }
        },
      },
    },
  },
  test: {
    environment: 'node',
    globals: true,
  },
})
