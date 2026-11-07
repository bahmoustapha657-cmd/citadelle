// Outils communs aux connecteurs d'opérateurs (module PUR).

// Jeton de notification reçu = celui remis par l'opérateur à la création ?
// Comparaison à temps constant (pas d'indice sur le bon jeton).
export function jetonNotificationValide(recu: string | undefined, attendu: unknown): boolean {
  const a = String(recu || "");
  const b = typeof attendu === "string" ? attendu : "";
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Corps JSON d'une réponse, {} si illisible.
export async function lireJson(r: Response): Promise<Record<string, unknown>> {
  return await r.json().catch(() => ({})) as Record<string, unknown>;
}
