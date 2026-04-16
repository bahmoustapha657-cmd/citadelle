import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
