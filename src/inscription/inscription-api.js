import { getSupabase } from "../supabaseClient";

// Soumet la création d'une nouvelle école (Edge Function inscription).
// Renvoie { ok, data } ; le décodage JSON est tolérant aux réponses vides.
export async function soumettreInscription(form) {
  const payload = {
    nomEcole: form.nomEcole,
    ville: form.ville,
    pays: form.pays,
    responsable: form.responsable,
    telephone: form.telephone,
    email: form.email,
    website: form.website,
    adminLogin: form.adminLogin,
    adminMdp: form.adminMdp,
  };
  const { data, error } = await getSupabase().functions.invoke("inscription", { body: payload });
  if (error) {
    let msg = "Inscription impossible.";
    try { msg = (await error.context?.json())?.error || msg; } catch { /* défaut */ }
    return { ok: false, data: { error: msg } };
  }
  return { ok: !!data?.ok, data };
}
