// ── Une personne, plusieurs espaces : carte de la Direction ────────────────
// Module PUR (tests/espaces-multiples.test.js) : groupes de comptes déjà
// reliés (même personne_id) et suggestions de comptes qui semblent être ceux
// d'une même personne (même nom, ou même e-mail). La Direction confirme
// toujours : un homonyme n'est pas la même personne.

const normaliser = (s) => String(s || "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();

// « Diallo Mamadou » et « Mamadou DIALLO » : même clé (mots triés).
export const cleNom = (nom) => normaliser(nom).split(" ").filter(Boolean).sort().join(" ");

const reliable = (c) => c && c.role !== "superadmin" && !c.extra?.fusionneDans && c.user_id !== null;

// Groupes déjà reliés (même personne_id), triés par nom pour l'affichage.
export function groupesRelies(comptes = []) {
  const parPersonne = new Map();
  for (const c of comptes) {
    if (!c.personne_id) continue;
    if (!parPersonne.has(c.personne_id)) parPersonne.set(c.personne_id, []);
    parPersonne.get(c.personne_id).push(c);
  }
  return [...parPersonne.entries()]
    .map(([personneId, liste]) => ({ personneId, comptes: liste }))
    .sort((a, b) => String(a.comptes[0]?.nom || "").localeCompare(String(b.comptes[0]?.nom || "")));
}

// Comptes qui semblent appartenir à une même personne et ne sont pas encore
// tous reliés entre eux : même e-mail, ou même nom (2 mots au moins, pour ne
// pas rapprocher deux « Admin »). Au moins deux rôles différents : deux
// comptes parents d'un même nom relèvent des doublons parents, pas d'ici.
export function suggestionsEspaces(comptes = []) {
  const candidats = comptes.filter(reliable);
  const groupes = new Map();
  const ajouter = (cle, c) => {
    if (!groupes.has(cle)) groupes.set(cle, new Map());
    groupes.get(cle).set(c.id, c);
  };
  for (const c of candidats) {
    const email = String(c.email || "").trim().toLowerCase();
    if (email) ajouter(`email:${email}`, c);
    const nom = cleNom(c.nom);
    if (nom.split(" ").length >= 2) ajouter(`nom:${nom}`, c);
  }
  const vus = new Set();
  const resultat = [];
  for (const [cle, membres] of groupes) {
    const liste = [...membres.values()];
    if (liste.length < 2) continue;
    if (new Set(liste.map((c) => c.role)).size < 2) continue;
    const dejaRelies = liste.every((c) => c.personne_id && c.personne_id === liste[0].personne_id);
    if (dejaRelies) continue;
    const signature = liste.map((c) => c.id).sort().join(",");
    if (vus.has(signature)) continue;
    vus.add(signature);
    resultat.push({ cle, motif: cle.startsWith("email:") ? "Même e-mail" : "Même nom", comptes: liste });
  }
  return resultat;
}

// Libellé d'un espace (choix d'espace, carte de la Direction).
export function libelleEspace(e = {}) {
  if (e.role === "enseignant") return { icone: "👨‍🏫", titre: "Enseignant" };
  if (e.role === "parent") return { icone: "👪", titre: "Parent d'élève" };
  return { icone: "🗂️", titre: e.label || "Personnel" };
}
