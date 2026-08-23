// ── Conversion data URL → Blob, sans réseau ────────────────────────────────
// L'idiome habituel est `await (await fetch(dataUrl)).blob()`. Il marche en
// développement et ÉCHOUE en production :
//
//     Fetch API cannot load data:image/jpeg;base64,… Refused to connect
//     because it violates the document's Content Security Policy.
//
// `fetch()` relève de `connect-src`, et la CSP du site (public/_headers)
// n'autorise que l'API Supabase et consorts. `img-src` accepte bien `data:`,
// mais c'est une autre directive : afficher l'image marchait, la convertir
// non — donc toute mise en ligne de photo d'élève, de logo, de signature ou
// de bannière échouait silencieusement.
//
// Le remède n'est pas d'ouvrir `connect-src data:` : décoder du base64 est une
// opération PUREMENT LOCALE, elle n'a aucune raison de traverser la couche
// réseau. On la fait à la main, ce qui la rend au passage insensible à toute
// future politique de sécurité.
export function dataUrlToBlob(dataUrl) {
  const texte = String(dataUrl || "");
  const virgule = texte.indexOf(",");
  if (!texte.startsWith("data:") || virgule === -1) {
    throw new Error("Valeur attendue : une data URL.");
  }
  const entete = texte.slice("data:".length, virgule);
  const enBase64 = entete.endsWith(";base64");
  // `data:,x` est valide et vaut text/plain — d'où le repli.
  const type = (enBase64 ? entete.slice(0, -";base64".length) : entete) || "text/plain";
  const charge = texte.slice(virgule + 1);

  if (!enBase64) return new Blob([decodeURIComponent(charge)], { type });

  const binaire = atob(charge);
  // Passage par un Uint8Array : une chaîne remise telle quelle à Blob serait
  // ré-encodée en UTF-8 et le JPEG en sortirait corrompu.
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return new Blob([octets], { type });
}
