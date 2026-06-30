import { apiFetch } from "../apiClient";
import { isSupabase } from "../backend";
import { getSupabase } from "../supabaseClient";

// Soumet la création d'une nouvelle école via /inscription.
// Renvoie { ok, data } ; le décodage JSON est tolérant aux réponses vides.
export async function soumettreInscription(form) {
  const payload = {
    nomEcole: form.nomEcole,
    ville: form.ville,
    pays: form.pays,
    adminLogin: form.adminLogin,
    adminMdp: form.adminMdp,
  };
  if (isSupabase) {
    const { data, error } = await getSupabase().functions.invoke("inscription", { body: payload });
    if (error) {
      let msg = "Inscription impossible.";
      try { msg = (await error.context?.json())?.error || msg; } catch { /* défaut */ }
      return { ok: false, data: { error: msg } };
    }
    return { ok: !!data?.ok, data };
  }
  const r = await apiFetch("/inscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nomEcole: form.nomEcole,
      ville: form.ville,
      pays: form.pays,
      adminLogin: form.adminLogin,
      adminMdp: form.adminMdp,
    }),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, data };
}
