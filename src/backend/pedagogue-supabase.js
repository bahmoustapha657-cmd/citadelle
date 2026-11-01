// ── « Mes fiches » : Pédagogue depuis le portail enseignant ────────────────
// Les fiches de cours vivent dans Pédagogue (Guinée Éducation), un produit à
// part avec sa propre base. L'Edge `pedagogue-ticket` signe une autorisation de
// 2 minutes, que Pédagogue échange contre une session sans mot de passe.
import { getSupabase } from "../supabaseClient";

const PEDAGOGUE = "https://guinee-education.pages.dev";

// Dernier compte passé par ici sur cet appareil. Sans réseau, Pédagogue ouvre
// ses fiches déjà enregistrées, mais seulement celles de ce compte-là.
const CLE_DERNIER_COMPTE = "LC_pedagogueCompte";

function lienSansReseau(uid) {
  if (localStorage.getItem(CLE_DERNIER_COMPTE) === uid) return `${PEDAGOGUE}/fiches`;
  throw new Error("La première ouverture de vos fiches sur cet appareil demande une connexion internet.");
}

export async function lienMesFiches(uid) {
  if (navigator.onLine === false) return lienSansReseau(uid);
  const { data, error } = await getSupabase().functions.invoke("pedagogue-ticket", { body: {} });
  // Réseau faible : l'appareil se croit en ligne alors que l'appel n'est pas parti.
  if (error?.name === "FunctionsFetchError") return lienSansReseau(uid);
  if (error || !data?.ticket) {
    let msg = "Ouverture de vos fiches impossible. Réessayez dans un instant.";
    try { msg = (await error?.context?.json())?.error || msg; } catch { /* garde le défaut */ }
    throw new Error(msg);
  }
  localStorage.setItem(CLE_DERNIER_COMPTE, uid);
  return `${PEDAGOGUE}/edugest#ticket=${data.ticket}`;
}
