import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'fonts/*.woff2'],
      manifest: {
        name: 'Zone Arcade Inventory',
        short_name: 'ZoneArcade',
        description: 'Gestión de Inventario Premium',
        theme_color: '#09090b',
        background_color: '#09090b',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        // Never cache Supabase API calls
        navigateFallbackDenylist: [/^\/auth/],
        runtimeCaching: [
          // Google Fonts
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('exceljs')) return 'exceljs';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('lucide-react')) return 'ui-icons';
            if (id.includes('recharts')) return 'ui-charts';
            if (id.includes('react-virtuoso')) return 'ui-virtual';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) return 'vendor';
            // Any other node_modules will fall into smaller auto-generated chunks
          }
        }
      }
    },
    chunkSizeWarningLimit: 1000 // Aumentamos el límite de advertencia a 1MB por exceljs
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
  }
})
