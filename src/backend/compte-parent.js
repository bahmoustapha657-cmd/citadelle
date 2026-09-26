// ── Compte parent : création, ou rattachement au compte du foyer ───────────
// Aiguillage selon le backend (comme session.js). C'est le serveur qui
// décide : si le foyer des élèves a déjà un compte parent, il les y rattache
// (mot de passe inchangé), sinon il crée le compte —
// supabase/functions/account-manage/foyer.ts, et api/_lib/account-links.js
// pour l'API Firebase.
import { apiFetch, getAuthHeaders } from "../apiClient";
import { isSupabase } from "../backend";
import { payloadCompteParent } from "../comptes-parents";
import { creerCompte as creerCompteSb } from "./account-manage-supabase";
import { powerSyncConfigured } from "./powersync/tables";

// Renvoie { login, rattache, dejaRattache }. `apresInscription` : élèves
// tout juste inscrits (saisie rapide) — en mode hors ligne ils sont d'abord
// écrits sur l'appareil, et le serveur ne les trouverait pas encore : on
// attend qu'ils soient remontés.
export async function creerOuRattacherCompteParent({ apresInscription = false, ...params }) {
  const payload = payloadCompteParent(params);
  let data;
  if (isSupabase) {
    if (apresInscription && powerSyncConfigured) {
      await import("./powersync/client").then((m) => m.attendreRemontee()).catch(() => {});
    }
    data = await creerCompteSb(payload);
  } else {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await apiFetch("/account-manage", {
      method: "POST", headers, body: JSON.stringify({ action: "create", ...payload }),
    });
    data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "Création du compte parent impossible.");
  }
  return {
    login: data.login || data.compte?.login || payload.login,
    rattache: Boolean(data.merged || data.mergedIntoExisting),
    dejaRattache: Boolean(data.dejaRattache),
  };
}
