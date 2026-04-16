import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inclure tous les assets statiques dans le cache de l'app shell
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff,woff2}'],
        // Stratégies de cache pour les ressources dynamiques
        runtimeCaching: [
          {
            // Firebase Firestore — NetworkFirst avec fallback cache
            urlPattern: /^https:\/\/firestore\.googleapis\.com/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'firestore-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firebase Storage (photos) — CacheFirst (rarement changées)
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'firebase-storage',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firebase Auth — NetworkOnly (l'auth nécessite toujours internet)
            urlPattern: /^https:\/\/(identitytoolkit|securetoken)\.googleapis\.com/,
            handler: 'NetworkOnly',
          },
          {
            // API routes Vercel — NetworkFirst avec fallback
            urlPattern: /^\/api\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 8,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Web App Manifest
      manifest: {
        name: 'EduGest — Gestion Scolaire',
        short_name: 'EduGest',
        description: 'Solution SaaS de gestion scolaire intelligente pour l\'Afrique',
        theme_color: '#0A1628',
        background_color: '#0A1628',
        display: 'standalone',
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'fr',
        categories: ['education', 'productivity', 'business'],
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        screenshots: [
          {
            src: '/favicon.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            form_factor: 'wide',
            label: 'EduGest — Tableau de bord',
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      // Ces packages sont réservés aux API routes Vercel (côté serveur).
      // On les exclut explicitement du bundle client pour éviter toute
      // inclusion accidentelle et réduire la taille du bundle.
      external: ['firebase-admin', 'firebase-admin/app', 'firebase-admin/auth',
                 'firebase-admin/firestore', '@anthropic-ai/sdk',
                 'firebase-functions', 'firebase-functions/v2/https'],
    },
  },
})


