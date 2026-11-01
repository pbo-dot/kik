import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// base './' gør at appen virker fra en undermappe, fx GitHub Pages /kik/
export default defineConfig({
  base: './',
  define: {
    __BUILD__: JSON.stringify(new Date().toLocaleString('da-DK', { timeZone: 'Europe/Copenhagen', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Kik',
        short_name: 'Kik',
        description: 'Peg på noget, og spørg',
        lang: 'da',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f6f7fb',
        theme_color: '#f6f7fb',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
