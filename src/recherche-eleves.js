// ══════════════════════════════════════════════════════════════
//  Recherche d'élèves (Comptabilité → Élèves et Mensualités)
// ══════════════════════════════════════════════════════════════
// Module PUR (testé par tests/recherche-eleves.test.js). Une saisie, un
// critère : matricule, filiation, numéro ou nom du tuteur — ou « Tout », qui
// lit aussi le nom de l'élève.
// Recherche collective : plusieurs termes séparés par une virgule, un
// point-virgule ou un retour à la ligne (« C-25-001, C-25-014 ») ; un élève
// est retenu dès qu'il répond à l'un d'eux. Chercher un tuteur (nom ou
// numéro) réunit, de fait, toute sa fratrie.

export const CRITERES_RECHERCHE = [
  { id: "tout", label: "Tout", exemple: "nom, matricule, filiation, tuteur ou téléphone" },
  { id: "matricule", label: "Matricule", exemple: "C-25-001" },
  { id: "filiation", label: "Filiation", exemple: "Mariama Bah" },
  { id: "telTuteur", label: "N° du tuteur", exemple: "622 12 34 56" },
  { id: "nomTuteur", label: "Nom du tuteur", exemple: "Mamadou Diallo" },
];

// Texte comparable : minuscules, sans accents, ponctuation → espace.
const texte = (s) => String(s ?? "").toLowerCase()
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, " ").trim();
const compact = (s) => texte(s).replace(/ /g, "");

// Chiffres du numéro national : l'indicatif (+224, 00224) est retiré, pour
// que « +224 622… » et « 622… » se retrouvent.
function chiffresNumero(s) {
  let d = String(s ?? "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("224") && d.length > 9) d = d.slice(3);
  return d;
}

// Termes de la recherche collective, dans l'ordre de saisie.
export const termesRecherche = (saisie) => String(saisie ?? "")
  .split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean);

export const rechercheActive = (saisie) => termesRecherche(saisie).length > 0;

// Tous les mots du terme figurent dans le champ, dans n'importe quel ordre :
// « bah mariama » trouve « Mariama BAH ».
function contientMots(champ, terme) {
  const mots = texte(terme).split(" ").filter(Boolean);
  if (!mots.length) return false;
  const h = texte(champ);
  return mots.every((m) => h.includes(m));
}

// Tirets et espaces ignorés : « c25001 » trouve « C-25-001 ».
function contientMatricule(e, terme) {
  const q = compact(terme);
  return Boolean(q) && compact(e.matricule).includes(q);
}

// Le numéro — ou un morceau d'au moins 3 chiffres — figure dans l'un des
// numéros du tuteur ; plusieurs numéros sur la fiche (« 622… / 655… ») sont
// lus un par un.
const MIN_CHIFFRES = 3;
function contientNumero(e, terme) {
  const q = chiffresNumero(terme);
  if (q.length < MIN_CHIFFRES) return false;
  return String(e.contactTuteur ?? "").split(/[/,;]| ou /i)
    .some((n) => chiffresNumero(n).includes(q));
}

// Un terme fait de chiffres (espaces, +, tirets admis) se lit comme un numéro.
const ressembleNumero = (terme) => /^[\d\s+().-]+$/.test(terme);

const CORRESPONDANCES = {
  tout: (e, t) => contientMots(
    [e.nom, e.prenom, e.surnom, e.matricule, e.ien, e.filiation, e.tuteur].join(" "), t,
  ) || contientMatricule(e, t) || (ressembleNumero(t) && contientNumero(e, t)),
  matricule: contientMatricule,
  filiation: (e, t) => contientMots(e.filiation, t),
  telTuteur: contientNumero,
  nomTuteur: (e, t) => contientMots(e.tuteur, t),
};

const correspondance = (critere) => CORRESPONDANCES[critere] || CORRESPONDANCES.tout;

// Élèves qui répondent à l'un des termes, dans l'ordre reçu. Sans saisie, la
// liste revient telle quelle.
export function rechercherEleves(eleves = [], saisie = "", critere = "tout") {
  const termes = termesRecherche(saisie);
  if (!termes.length) return eleves;
  const correspond = correspondance(critere);
  return eleves.filter((e) => termes.some((t) => correspond(e || {}, t)));
}

// Recherche collective : les termes qui ne trouvent personne dans la liste
// (un matricule mal recopié, un élève d'une autre section…).
export function termesSansResultat(eleves = [], saisie = "", critere = "tout") {
  const termes = termesRecherche(saisie);
  if (termes.length < 2) return [];
  const correspond = correspondance(critere);
  return termes.filter((t) => !eleves.some((e) => correspond(e || {}, t)));
}
