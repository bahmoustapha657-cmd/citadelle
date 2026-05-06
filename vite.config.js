import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // En local, Vite injecte un preamble inline pour React Fast Refresh.
      // On autorise donc explicitement les scripts inline uniquement sur le serveur de dev.
      "Content-Security-Policy": "default-src 'self' data: blob: http: https: ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http: https:; script-src-elem 'self' 'unsafe-inline' blob: http: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: http: https:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; frame-src 'self';",
    },
  },
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
