import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { lireVersionBuild } from "./scripts/version-build.mjs";

// Identité du build (commit, branche, arbre propre) : embarquée dans l'app
// (__EDUGEST_VERSION__, cf. src/version-app.js) et publiée en /version.json
// pour savoir d'un coup d'œil ce qui tourne en production.
const VERSION = lireVersionBuild();

function versionJson() {
  return {
    name: "edugest-version-json",
    apply: "build",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "version.json", source: JSON.stringify(VERSION, null, 2) + "\n" });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionJson()],
  define: {
    __EDUGEST_VERSION__: JSON.stringify(VERSION),
  },
  // PowerSync (mode hors ligne, branche Supabase) : wa-sqlite tourne dans un
  // worker + charge un binaire WASM. Le pré-bundling Vite (esbuild) casse ces
  // deux paquets → on les en exclut explicitement (recette officielle PowerSync).
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@journeyapps/wa-sqlite", "@powersync/web"],
  },
  server: {
    headers: {
      // En local, Vite injecte un preamble inline pour React Fast Refresh.
      // On autorise donc explicitement les scripts inline uniquement sur le serveur de dev.
      "Content-Security-Policy": "default-src 'self' data: blob: http: https: ws: wss:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: http: https:; script-src-elem 'self' 'unsafe-inline' blob: http: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: http: https:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; frame-src 'self';",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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
