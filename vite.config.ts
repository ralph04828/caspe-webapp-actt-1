import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  const buildVersion = `${Date.now()}`;
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'SWOOOSH — Fashion Social Network & Digital Wardrobe',
          short_name: 'SWOOOSH',
          description: 'SWOOOSH is a fashion social network: share your fits, build your wardrobe, plan your outfits, and connect with friends.',
          theme_color: '#171717',
          background_color: '#171717',
          display: 'standalone',
          orientation: 'portrait-primary',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          cacheId: `swooosh-${buildVersion}`,
          skipWaiting: true,
          clientsClaim: true,
          cleanupOutdatedCaches: true,
          navigateFallback: null,
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,ico,png,svg,jpg,webp,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) =>
                request.mode === 'navigate' || request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'swooosh-html',
                networkTimeoutSeconds: 4,
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/api\.open-meteo\.com\/.*/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'open-meteo-weather',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60, // 1 hour
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/geocoding-api\.open-meteo\.com\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'open-meteo-geocode',
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      port: 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      port: Number(process.env.PORT) || 3000,
      host: '0.0.0.0',
      allowedHosts: true as const,
    },
  };
});
