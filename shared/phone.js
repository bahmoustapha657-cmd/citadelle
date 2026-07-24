// ── Normalisation des numéros de téléphone (Guinée) ─────────────────────────
// E.164 Guinée : +224 suivi de 9 chiffres, mobile commençant par 6.
// Utilisé côté app (audit, aperçu de portée) ET côté Edge Function `notify`
// (résolution du destinataire). Renvoie null si le numéro est irrécupérable
// (vide, nom écrit à la place, ancien format 8 chiffres, etc.).

export function normaliserTelGuinee(brut) {
  if (!brut) return null;
  // Garde le premier numéro si plusieurs (séparés par / , ; ou « ou »).
  const premier = String(brut).split(/[/,;]| ou /i)[0];
  let d = premier.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("224")) d = d.slice(3);
  // d = numéro national attendu : 9 chiffres commençant par 6.
  if (d.length === 9 && d.startsWith("6")) return "+224" + d;
  return null;
}

// Vrai si le numéro est joignable (normalisable).
export function estJoignable(brut) {
  return normaliserTelGuinee(brut) !== null;
}
