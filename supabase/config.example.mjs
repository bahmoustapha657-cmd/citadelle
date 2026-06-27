// ── Configuration Supabase (MODÈLE) ─────────────────────────────────────────
// 1) COPIE ce fichier dans le même dossier et nomme la copie : config.local.mjs
// 2) Colle tes 3 valeurs depuis Supabase : Project Settings (⚙️) → API
// 3) Enregistre.
//
// config.local.mjs est ignoré par git → tes clés restent privées.
export default {
  url: "https://xxxx.supabase.co",            // « Project URL »
  anonKey: "COLLE_LA_CLE_anon_public",        // clé « anon public »
  serviceRole: "COLLE_LA_CLE_service_role",   // clé « service_role » (secrète)
};
