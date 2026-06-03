import { apiFetch } from "../apiClient";

// Soumet la création d'une nouvelle école via /inscription.
// Renvoie { ok, data } ; le décodage JSON est tolérant aux réponses vides.
export async function soumettreInscription(form) {
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
