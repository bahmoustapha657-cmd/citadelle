// ── À qui appartient le miroir local ? ──────────────────────────────────────
// Le miroir PowerSync est CONSERVÉ à la déconnexion : quand le même compte
// revient, PowerSync ne télécharge que ce qui a changé depuis (quelques Ko)
// au lieu de toute l'école (≈ 5 Mo à La Citadelle, dont 3,6 Mo de notes) — le
// facteur décisif sur une connexion faible. Il n'est vidé que lorsqu'un AUTRE
// compte se connecte sur l'appareil (poste partagé, autre école, parent).
//
// Module léger (aucun import de @powersync/web) : auth-supabase.js le lit à
// chaque connexion pour ne charger le moteur SQLite que s'il faut purger.
const CLE = "LC_powersync_proprietaire";

export function lireProprietaire() {
  try { return localStorage.getItem(CLE) || null; } catch { return null; }
}

export function ecrireProprietaire(uid) {
  try { localStorage.setItem(CLE, uid); } catch { /* stockage indisponible */ }
}

export function oublierProprietaire() {
  try { localStorage.removeItem(CLE); } catch { /* stockage indisponible */ }
}

// Vrai si le miroir porte (peut-être) les données d'un autre compte que `uid`.
// Sans propriétaire enregistré, le miroir est vide ou appartient à la session
// en cours : jusqu'ici chaque déconnexion le vidait, donc un miroir rempli
// sans propriétaire ne peut venir que du compte encore connecté.
export function miroirAutreCompte(uid) {
  const proprietaire = lireProprietaire();
  return !!proprietaire && proprietaire !== uid;
}
