import { apiFetch, getAuthHeaders } from "../../../apiClient";

// Appels /account-manage du panneau Admin. Lèvent une erreur explicite en
// cas d'échec ; la gestion d'état et des toasts reste dans useAdminPanel.

async function postAccountManage(body, messageEchec) {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await apiFetch("/account-manage", { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || messageEchec);
  return data;
}

export function creerCompte({ schoolId, login, mdp, role, nom, label }) {
  return postAccountManage(
    { action: "create", schoolId, login, mdp, role, nom, label, statut: "Actif" },
    `Création du compte ${login} impossible.`,
  );
}

export function reinitialiserMotDePasse({ schoolId, accountId, mdp }) {
  return postAccountManage(
    { action: "reset_password", schoolId, accountId, mdp },
    "Réinitialisation impossible.",
  );
}
