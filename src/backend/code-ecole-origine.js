// ── Code court → code d'origine d'une école ─────────────────────────────────
// Une école peut avoir, en plus de son code d'origine, un code court (un mot
// de son nom, migration 20261123184655_codes_ecole_courts.sql). Les Edge
// Functions (password-reset, account-manage) cherchent l'école par son code
// d'origine : la saisie est traduite AVANT de les appeler, par la RPC
// publique etat_ecole, qui renvoie toujours le code d'origine.
// Module à part, sans dépendance : ses appelants n'ont pas à charger tout
// auth-supabase.js.
import { getSupabase } from "../supabaseClient";

// Code inconnu, réseau coupé ou base pas encore migrée : la saisie telle
// quelle (en minuscules) — le serveur répond alors comme avant.
export async function codeEcoleOrigine(saisie) {
  const sid = String(saisie || "").trim().toLowerCase();
  if (!sid) return sid;
  try {
    const { data, error } = await getSupabase().rpc("etat_ecole", { p_code: sid });
    return (!error && data?.[0]?.code) || sid;
  } catch {
    return sid;
  }
}
