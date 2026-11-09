import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const version = process.env.npm_package_version ?? '0.0.0';

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    // version.json lets an installed copy notice it is out of date and repair itself.
    {
      name: 'version-json',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'NorthPrep',
        short_name: 'NorthPrep',
        description: 'Offline survival prep planner and field journal for the Canadian Shield.',
        theme_color: '#0b0b0b',
        background_color: '#0b0b0b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything the app ships, including bundled reference data and images.
        // Core app only, so updates install quickly and reliably. Field-guide photos are
        // downloaded separately in the background (src/lib/offlinePhotos.ts).
        globPatterns: ['**/*.{js,mjs,css,html,json,svg,png,jpg,jpeg,webp,woff2,ico}'],
        globIgnores: ['guide-images/**', 'version.json'],
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        // Map tiles: served from the cache the app fills with "Save this area for offline".
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/guide-images/'),
            handler: 'CacheFirst',
            options: { cacheName: 'guide-images', cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'maps-cartes.services.geo.ca' || url.hostname === 'maps.geogratis.gc.ca',
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 40000 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
  },
});
