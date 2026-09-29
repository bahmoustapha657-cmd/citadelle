// ════════════════════════════════════════════════════════════════════════
//  Numéros de téléphone guinéens — partagé par les Edge Functions
// ════════════════════════════════════════════════════════════════════════
// Miroir de shared/phone.js, que Deno ne partage pas ; tests/comptes-
// parents.test.js vérifie qu'ils restent identiques. Module SANS dépendance :
// account-manage (foyer.ts) et password-reset l'importent, les tests Node le
// chargent tel quel.

// E.164 Guinée : +224 suivi de 9 chiffres, mobile commençant par 6. Garde le
// premier numéro si plusieurs sont saisis. null si irrécupérable.
export function normaliserTel(brut: unknown): string | null {
  if (!brut) return null;
  const premier = String(brut).split(/[/,;]| ou /i)[0];
  let d = premier.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("224")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("6")) return "+224" + d;
  return null;
}

// Numéro national à 9 chiffres (« 622123456 ») : l'identifiant de connexion
// proposé aux parents. null si le numéro n'est pas exploitable.
export function numeroNational(brut: unknown): string | null {
  const tel = normaliserTel(brut);
  return tel ? tel.slice(4) : null;
}

// Identifiant saisi à la connexion : un numéro écrit à sa façon
// (« 622 12 34 56 », « +224 622… ») devient l'identifiant à 9 chiffres ;
// un identifiant ordinaire ou un e-mail reste tel quel.
export function identifiantConnexion(saisie: unknown): string {
  const s = String(saisie ?? "").trim();
  if (/[a-z@]/i.test(s)) return s;
  return numeroNational(s) ?? s;
}
