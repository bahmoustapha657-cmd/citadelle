// ── Rattachement d'un espace enseignant à l'école qui adopte EduGest ──────
// Logique PURE (tests/rattachement.test.js). Étape 3 (décisions du
// 2026-11-18) : l'enseignant propose, la direction relie SES élèves à ceux
// de l'école puis accepte. Un élève qu'on ne retrouve pas est relié à la
// main ou laissé de côté : aucun élève n'est créé hors de l'inscription
// normale. Le serveur refait les mêmes contrôles (account-manage/
// rattachement.ts, rattachement_appliquer).

// Texte comparable : sans accents, sans casse, sans ponctuation.
export const normaliser = (s) => String(s ?? "")
  .normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// Identité d'un élève : ses noms et prénoms, dans n'importe quel ordre
// (« DIALLO Aissatou » = « Aïssatou Diallo »).
export const cleNomEleve = (e) => normaliser(`${e?.nom || ""} ${e?.prenom || ""}`)
  .split(" ").filter(Boolean).sort().join(" ");

// Classe de l'école proposée pour une classe de l'enseignant : même section,
// même nom. Sinon aucune (la direction choisit).
export function proposerClasse(classeEns, classesEcole = []) {
  const nom = normaliser(classeEns?.nom);
  const trouvee = classesEcole.find((c) => c.section === classeEns?.section && normaliser(c.nom) === nom);
  return trouvee ? trouvee.nom : "";
}

// Élèves de l'école proposés : même identité, et sans ambiguïté des deux
// côtés (deux homonymes dans la classe → la direction choisit elle-même).
export function proposerEleves(elevesEns = [], elevesEcole = []) {
  const parCleEcole = new Map();
  for (const e of elevesEcole) {
    const cle = cleNomEleve(e);
    if (!cle) continue;
    parCleEcole.set(cle, parCleEcole.has(cle) ? null : e.id);
  }
  const parCleEns = new Map();
  for (const e of elevesEns) {
    const cle = cleNomEleve(e);
    parCleEns.set(cle, (parCleEns.get(cle) || 0) + 1);
  }
  const choix = {};
  for (const e of elevesEns) {
    const cle = cleNomEleve(e);
    const cible = cle && parCleEns.get(cle) === 1 ? parCleEcole.get(cle) : null;
    choix[e.id] = cible || "";
  }
  return choix;
}

// Matière de l'école proposée pour une matière de ses notes : même nom.
export function proposerMatiere(nom, matieresEcole = []) {
  const n = normaliser(nom);
  return matieresEcole.find((m) => normaliser(m) === n) || "";
}

// Son compte enseignant déjà ouvert dans l'école : celui dont l'identifiant
// est son numéro (ou l'identifiant interne ens.<numéro>), sinon celui qui
// porte son nom. null si rien ne correspond.
export function compteProbable(comptes = [], { login = "", nom = "" } = {}) {
  const enseignants = comptes.filter((c) => c.role === "enseignant");
  const numero = String(login || "").trim();
  if (numero) {
    const parNumero = enseignants.find((c) => c.login === numero || c.login === `ens.${numero}`);
    if (parNumero) return parNumero;
  }
  const cle = cleNomEleve({ nom });
  if (!cle) return null;
  const memeNom = enseignants.filter((c) => cleNomEleve({ nom: c.nom }) === cle);
  return memeNom.length === 1 ? memeNom[0] : null;
}

// Nom et prénom proposés pour sa fiche : les mots en MAJUSCULES forment le
// nom (« Ibrahima DIALLO »), sinon le dernier mot. La direction corrige.
export function decouperNom(nomComplet) {
  const mots = String(nomComplet || "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return { nom: "", prenom: "" };
  const majuscules = mots.filter((m) => m.length > 1 && m === m.toUpperCase() && /\p{L}/u.test(m));
  if (majuscules.length && majuscules.length < mots.length) {
    return { nom: majuscules.join(" "), prenom: mots.filter((m) => !majuscules.includes(m)).join(" ") };
  }
  if (mots.length === 1) return { nom: mots[0], prenom: "" };
  return { nom: mots[mots.length - 1], prenom: mots.slice(0, -1).join(" ") };
}

// Section la plus représentée parmi les classes de l'école choisies.
export function sectionPrincipale(classesChoisies = [], defaut = "") {
  const compte = new Map();
  for (const c of classesChoisies) compte.set(c.section, (compte.get(c.section) || 0) + (c.poids || 1));
  let meilleure = defaut;
  let max = 0;
  for (const [section, n] of compte) if (n > max) { meilleure = section; max = n; }
  return meilleure;
}

// Ce que la direction a choisi → corps envoyé à accepter_rattachement.
// `choixClasses` : { "<section>|<classe de l'enseignant>": "<classe de l'école>" }.
export function construireAcceptation({ apercu, choixClasses = {}, choixEleves = {}, choixMatieres = {}, compte = {} }) {
  const classes = [];
  const vues = new Set();
  for (const c of apercu?.classes || []) {
    const nom = choixClasses[`${c.section}|${c.nom}`];
    if (!nom) continue;
    const cle = `${c.section}|${nom}`;
    if (!vues.has(cle)) { vues.add(cle); classes.push({ section: c.section, classe: nom }); }
  }
  const eleves = Object.fromEntries(Object.entries(choixEleves).filter(([, v]) => v));
  const matieres = Object.fromEntries(Object.entries(choixMatieres).filter(([, v]) => v));
  const base = { eleves, matieres, classes };
  if (compte.compteId) return { ...base, compteId: compte.compteId };
  return {
    ...base,
    nouveau: {
      nom: String(compte.nom || "").trim(), prenom: String(compte.prenom || "").trim(),
      section: compte.section || "", matiere: String(compte.matiere || "").trim(),
    },
  };
}

// Mêmes exigences que le serveur (rattachement.ts, validerAcceptation).
export function erreurAcceptation(corps, t) {
  const cibles = Object.values(corps.eleves || {});
  if (!cibles.length) return t("rattachement.errNoStudent");
  if (new Set(cibles).size !== cibles.length) return t("rattachement.errSameStudent");
  if (!corps.classes?.length) return t("rattachement.errNoClass");
  if (!corps.compteId) {
    if (!corps.nouveau?.nom) return t("rattachement.errName");
    if (!corps.nouveau?.section) return t("rattachement.errSection");
  }
  return "";
}

// Bilan annoncé avant d'accepter. Les notes comptées sont celles des élèves
// reliés ; celles d'une matière laissée de côté ne passent pas.
export function bilanPrevu(apercu, choixEleves = {}, choixMatieres = {}) {
  const eleves = (apercu?.classes || []).flatMap((c) => c.eleves || []);
  const relies = eleves.filter((e) => choixEleves[e.id]);
  const matieresLaissees = (apercu?.matieres || []).filter((m) => !choixMatieres[m.nom]);
  return {
    elevesRelies: relies.length,
    elevesLaisses: eleves.length - relies.length,
    notesElevesRelies: relies.reduce((s, e) => s + (Number(e.notes) || 0), 0),
    matieresLaissees: matieresLaissees.map((m) => m.nom),
  };
}

// Périodes de ses notes que l'école n'emploie pas (trimestres chez une
// école au semestre…) : ses notes y arrivent telles quelles, et l'outil des
// périodes orphelines de l'école sert à les ranger.
export function periodesEtrangeres(periodesEnseignant = [], periodesEcole = []) {
  const connues = new Set(periodesEcole);
  return periodesEnseignant.filter((p) => p && !connues.has(p));
}
