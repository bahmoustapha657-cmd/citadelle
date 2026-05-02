import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cloudflare()],
  build: {
    rollupOptions: {
      // Ces packages sont reserves aux API routes Vercel (cote serveur).
      // On les exclut explicitement du bundle client pour eviter toute
      // inclusion accidentelle et reduire la taille du bundle.
      external: [
        "firebase-admin",
        "firebase-admin/app",
        "firebase-admin/auth",
        "firebase-admin/firestore",
        "@anthropic-ai/sdk",
        "firebase-functions",
        "firebase-functions/v2/https",
      ],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/firebase/") || id.includes("node_modules/@firebase/") || id.includes("node_modules/idb")) {
            return "firebase-vendor";
          }
          if (id.includes("node_modules/recharts/") || id.includes("node_modules/d3-")) {
            return "charts-vendor";
          }
          if (id.includes("node_modules/xlsx/")) {
            return "xlsx-vendor";
          }
          if (id.includes("node_modules/qrcode/")) {
            return "qrcode-vendor";
          }
        },
      },
    },
  },
});