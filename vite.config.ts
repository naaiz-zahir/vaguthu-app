import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Vaguthu — Time Log',
        short_name: 'Vaguthu',
        description: 'Log how you spent your day and see where your time goes.',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f9f9f7',
        theme_color: '#2a78d6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        // Leave Firebase Auth's reserved /__/ routes to the network.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  build: { chunkSizeWarningLimit: 1000 },
});
