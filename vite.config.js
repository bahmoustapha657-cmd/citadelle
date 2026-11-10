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

// Les textes anglais et arabes sont chargés à la demande (src/i18n) : ils ne
// figurent donc pas parmi les fichiers de démarrage que le service worker
// range d'avance avec la page d'accueil (rafraichirCoque, public/sw.js). Sans
// eux, après une mise à jour, une ouverture hors ligne retomberait en
// français. Chaque fichier de langue est donc cité dans index.html par un
// <link> de type inconnu : le navigateur l'ignore (rien n'est téléchargé pour
// l'affichage), le service worker le lit et range le fichier.
function languesDansLaCoque() {
  return {
    name: "edugest-langues-coque",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        return Object.values(ctx.bundle || {})
          .filter((c) => c.type === "chunk" && /[\\/]i18n[\\/]locales[\\/]\w+\.json$/.test(c.facadeModuleId || ""))
          .map((c) => ({ tag: "link", attrs: { rel: "edugest-langue", href: `/${c.fileName}` }, injectTo: "head" }));
      },
    },
  };
}

// Liste des modules de l'application (/precache.json) : le service worker
// les range tous sur l'appareil en arrière-plan (rangerModules, public/sw.js).
// Sans elle, un module chargé à la demande (Comptabilité, École…) n'était
// gardé hors ligne qu'après avoir été ouvert une fois en ligne — à refaire
// après chaque mise à jour qui le modifiait. Le WebAssembly (base locale,
// détourage des photos) n'y figure pas : plusieurs Mo, gardés à l'usage, et
// le chargeur du détourage ne sert à rien sans lui.
function listeModules() {
  return {
    name: "edugest-liste-modules",
    apply: "build",
    generateBundle(_options, bundle) {
      const fichiers = Object.keys(bundle)
        .filter((f) => f.startsWith("assets/") && /\.(js|css)$/.test(f) && !f.includes("vision_wasm_internal"))
        .sort()
        .map((f) => `/${f}`);
      this.emitFile({ type: "asset", fileName: "precache.json", source: `${JSON.stringify(fichiers)}\n` });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), versionJson(), languesDansLaCoque(), listeModules()],
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
    // Le tableau final « gzip: … » de vite build compresse chaque fichier
    // émis, dont ~30 Mo de WebAssembly (MediaPipe, wa-sqlite) : ~20 % du
    // temps de build pour une information purement indicative. Les fichiers
    // produits sont identiques ; seule la colonne gzip disparaît du terminal.
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // Découpage natif de Rolldown (Vite 8). Chaque groupe aspire aussi ses
        // dépendances : sans groupe React prioritaire, React finissait dans
        // charts-vendor, que la première page devait alors précharger
        // (~118 kB gzip de recharts + d3 inutiles au démarrage).
        codeSplitting: {
          groups: [
            { name: "react-vendor", test: /node_modules[\\/](react|react-dom|scheduler|use-sync-external-store)[\\/]/, priority: 30 },
            { name: "charts-vendor", test: /node_modules[\\/](recharts|d3-[^\\/]+)[\\/]/, priority: 20 },
            { name: "xlsx-vendor", test: /node_modules[\\/]xlsx[\\/]/, priority: 10 },
            { name: "qrcode-vendor", test: /node_modules[\\/]qrcode[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
