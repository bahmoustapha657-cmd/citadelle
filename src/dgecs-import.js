// ── Pont DGECS → EduGest : liste des élèves de la plateforme du ministère ──
// Sur dgecsecoles.com (module « Liste des élèves », une classe choisie), le
// bouton « copier » met le tableau dans le presse-papiers (tabulations), le
// bouton « Excel » le télécharge. Colonnes relevées sur un vrai compte
// d'école le 2026-11-20 : N°, Matricule, Elève, Sexe, Date de naissance,
// Lieu de naissance, Père, Mère, Téléphone (+ Actions). « Elève » = PRÉNOMS
// NOM en majuscules (le nom est le dernier mot) ; matricule = 2 lettres + 8
// chiffres (MA25032033) ; date jj/mm/aaaa ; le père est souvent donné par son
// seul prénom. La classe n'est PAS dans le tableau : l'écran la demande.
//
// Ici : lecture du tableau collé, puis rapprochement avec les élèves
// d'EduGest (matricule DGECS = champ `ien`, cf. src/dgecs.js). Module pur,
// testé dans tests/dgecs-import.test.js ; écran : src/components/dgecs-import/.

export const URL_LISTE_DGECS = "https://dgecsecoles.com/inscrit";

// Matricule national tel que la plateforme le donne (MA25032033).
export const FORMAT_MATRICULE_DGECS = /^[A-Z]{2}\d{8}$/;

const sansAccents = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "");
const cle = (s) => sansAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// « MAMADOU ALIOU » → « Mamadou Aliou » ; « N'FALY » → « N'Faly » ;
// « ABDOUL-KARIM » → « Abdoul-Karim ».
export const enNomPropre = (s) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase()
  .replace(/(^|[\s'’-])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

export const normaliserMatriculeDgecs = (s) => String(s ?? "").toUpperCase().replace(/\s+/g, "");

// Texte collé → lignes de cellules. Le bouton « copier » sépare les cellules
// par des tabulations ; un tableau copié à la souris aussi. À défaut, le
// point-virgule (CSV à la française).
export function lireTexteTableau(texte) {
  const lignes = String(texte ?? "").replace(/\r\n?/g, "\n").split("\n");
  const sep = lignes.some((l) => l.includes("\t")) ? "\t" : ";";
  return lignes.map((l) => l.split(sep).map((c) => c.trim()));
}

// En-têtes reconnus (clé normalisée → champ). Variantes : la plateforme, sa
// fiche élève, et un tableau retouché à la main dans Excel.
const ENTETES = [
  ["matricule", "matricule"], ["matricule eleve", "matricule"], ["ien", "matricule"],
  ["eleve", "eleve"], ["prenom et nom", "eleve"], ["prenoms et nom", "eleve"], ["nom et prenom", "eleveNomDabord"], // i18n-ignore (en-têtes lus, pas affichés)
  ["nom", "nom"], ["prenom", "prenom"], ["prenoms", "prenom"],
  ["sexe", "sexe"], ["genre", "sexe"],
  ["date de naissance", "date"], ["date naissance", "date"], ["ne le", "date"], // i18n-ignore
  ["lieu de naissance", "lieu"], ["lieu naissance", "lieu"], ["ne a", "lieu"], // i18n-ignore
  ["pere", "pere"], ["mere", "mere"],
  ["telephone", "telephone"], ["tel", "telephone"], ["contact", "telephone"],
  ["classe", "classe"],
];
const CHAMP_ENTETE = new Map(ENTETES);

// Ligne d'en-tête : la première (dans les 10 premières, le bouton « copier »
// met d'abord le titre de la page) qui nomme un matricule et un élève.
function trouverEntete(lignes) {
  for (let i = 0; i < Math.min(10, lignes.length); i++) {
    const champs = lignes[i].map((c) => CHAMP_ENTETE.get(cle(c)));
    const aEleve = champs.some((c) => c === "eleve" || c === "eleveNomDabord" || c === "nom");
    if (champs.includes("matricule") && aEleve) {
      const cols = {};
      champs.forEach((c, idx) => { if (c && cols[c] === undefined) cols[c] = idx; });
      return { index: i, cols };
    }
  }
  return null;
}

const SEXES = new Map([["m", "M"], ["masculin", "M"], ["g", "M"], ["garcon", "M"], ["f", "F"], ["feminin", "F"], ["fille", "F"]]);

// jj/mm/aaaa (ou jj-mm-aaaa, jj.mm.aaaa) → aaaa-mm-jj ; ISO gardée ;
// le reste tel quel (la fiche le montrera, rien n'est perdu).
export function dateIso(s) {
  const v = String(s ?? "").trim();
  if (!v || /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v;
}

// « PRÉNOMS NOM » → { nom, prenom } : le nom est le dernier mot.
function separerNom(complet, nomDabord) {
  const mots = String(complet ?? "").trim().split(/\s+/).filter(Boolean);
  if (mots.length < 2) return { nom: mots[0] || "", prenom: "" };
  return nomDabord
    ? { nom: mots[0], prenom: mots.slice(1).join(" ") }
    : { nom: mots[mots.length - 1], prenom: mots.slice(0, -1).join(" ") };
}

// Filiation au format des autres imports (src/components/comptabilite/
// enrolment-import/row-parse.js) : les mots « Pere »/« Mere » sont ignorés
// par la comparaison des doublons (enrollment-utils, eleve_cle_filiation).
export const filiationDgecs = (pere, mere) => [pere && `Pere: ${pere}`, mere && `Mere: ${mere}`].filter(Boolean).join(" / ");

// Erreurs et avertissements : CODES, traduits par l'écran (dgecs.import.issues.*).
// Tableau DGECS (lignes de cellules) → { eleves, erreur }.
export function lireListeDgecs(lignes) {
  const entete = trouverEntete(lignes || []);
  if (!entete) return { eleves: [], erreur: "entete" };
  const { cols } = entete;
  const val = (ligne, champ) => (cols[champ] === undefined ? "" : String(ligne[cols[champ]] ?? "").trim());
  const eleves = [];
  const vus = new Map();
  for (const [i, ligne] of lignes.slice(entete.index + 1).entries()) {
    if (!ligne.some((c) => String(c ?? "").trim())) continue;
    const matricule = normaliserMatriculeDgecs(val(ligne, "matricule"));
    let { nom, prenom } = cols.nom !== undefined
      ? { nom: val(ligne, "nom"), prenom: val(ligne, "prenom") }
      : separerNom(val(ligne, cols.eleve !== undefined ? "eleve" : "eleveNomDabord"), cols.eleve === undefined);
    // Ligne de pied de tableau (« Affichage de l'élément 1 à 29… ») : ni
    // matricule ni nom complet.
    if (!matricule && !prenom) continue;
    nom = nom.toUpperCase();
    prenom = enNomPropre(prenom);
    const sexe = SEXES.get(cle(val(ligne, "sexe"))) || "";
    const pere = enNomPropre(val(ligne, "pere"));
    const mere = enNomPropre(val(ligne, "mere"));
    const erreurs = [];
    const avertissements = [];
    if (!matricule) erreurs.push("sansMatricule");
    else if (!FORMAT_MATRICULE_DGECS.test(matricule)) avertissements.push("matriculeInhabituel");
    if (!nom || !prenom) erreurs.push("sansNom");
    if (!sexe) avertissements.push("sansSexe");
    if (matricule && vus.has(matricule)) erreurs.push("matriculeEnDouble");
    if (matricule) vus.set(matricule, true);
    eleves.push({
      ligne: entete.index + i + 2,
      matricule, nom, prenom, sexe,
      dateNaissance: dateIso(val(ligne, "date")),
      lieuNaissance: enNomPropre(val(ligne, "lieu")),
      pere, mere,
      filiation: filiationDgecs(pere, mere),
      telephone: val(ligne, "telephone"),
      classeDgecs: val(ligne, "classe"),
      erreurs, avertissements,
    });
  }
  return { eleves, erreur: eleves.length ? null : "vide" };
}

// ── Rapprochement : nom, date de naissance, filiation ──────────────────────
// Un même élève s'écrit souvent autrement d'une saisie à l'autre : Mamadou /
// Mamadu, Camara / Kamara, Barry / Bary, Thierno / Tierno, Diallo / Djallo,
// un 2e prénom en plus ou en moins. Avant de déclarer un élève absent d'un
// côté ou de l'autre, on compare donc aussi les noms PROCHES, la date de
// naissance et la filiation (père, mère). Un nom proche ne pose un matricule
// d'office que si la date de naissance ou la filiation le confirme.

// Même personne, quel que soit l'ordre des mots : « BARRY Mamadou Aliou » et
// « Mamadou Aliou BARRY » donnent la même clé.
export const cleNomComplet = (nom, prenom) => cle(`${nom} ${prenom}`).split(" ").filter(Boolean).sort().join(" ");

// Mot réduit à sa prononciation, pour les graphies courantes en Guinée :
// ou→u, y→i, ph→f, th→t, dj et di+voyelle→j, c dur et qu→k, h muet, lettres
// doublées simplifiées, e final muet.
export function cleSonore(mot) {
  let s = cle(mot).replace(/[^a-z]/g, "")
    .replace(/ph/g, "f").replace(/th/g, "t").replace(/dj/g, "j").replace(/di(?=[aeiou])/g, "j")
    .replace(/qu/g, "k").replace(/c(?![eih])/g, "k")
    .replace(/ou/g, "u").replace(/y/g, "i")
    .replace(/([^cs])h/g, "$1").replace(/^h/, "")
    .replace(/(.)\1+/g, "$1");
  if (s.length > 3) s = s.replace(/e$/, "");
  return s;
}

// Distance d'édition (lettres ajoutées, retirées ou changées).
function distance(a, b) {
  let prec = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cour = [i];
    for (let j = 1; j <= b.length; j++) {
      cour[j] = Math.min(prec[j] + 1, cour[j - 1] + 1, prec[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prec = cour;
  }
  return prec[b.length];
}

// Deux mots se valent : même prononciation, ou une faute de frappe sur un
// mot d'au moins 4 lettres (2 à partir de 8 lettres).
const motsProches = (a, b) => {
  if (a === b) return true;
  const court = Math.min(a.length, b.length);
  return court >= 4 && distance(a, b) <= (court >= 8 ? 2 : 1);
};

// Nombre de mots de `a` retrouvés dans `b`, chaque mot ne servant qu'une
// fois (les mots identiques d'abord, puis les proches).
function motsCommuns(a, b) {
  const restA = [...a];
  const restB = [...b];
  let n = 0;
  for (const exact of [true, false]) {
    for (let i = restA.length - 1; i >= 0; i--) {
      const j = restB.findIndex((m) => (exact ? m === restA[i] : motsProches(restA[i], m)));
      if (j >= 0) { restA.splice(i, 1); restB.splice(j, 1); n++; }
    }
  }
  return n;
}

const motsNom = (nom, prenom) => cle(`${nom} ${prenom}`).split(" ").map(cleSonore).filter(Boolean);

// Mots qui ne disent rien des parents (« Pere: », « fils de », « feu »…).
const MOTS_VIDES_FILIATION = new Set([
  "pere", "mere", "fils", "fille", "de", "d", "du", "des", "et", "feu", "feue", "le", "la", "l",
  "mr", "mme", "m", "monsieur", "madame", "mlle", "ne", "nee", "epouse", "ep", "veuve", "tuteur", "tutrice", "enfant",
]);
const motsFiliation = (...textes) => cle(textes.filter(Boolean).join(" ")).split(" ")
  .filter((m) => m && !MOTS_VIDES_FILIATION.has(m)).map(cleSonore).filter(Boolean);

const cleSonoreNom = (mots) => [...mots].sort().join(" ");

// Noms : "identique" (mêmes mots, dans n'importe quel ordre), "sonore" (mêmes
// mots à la prononciation près : Abdoulaye / Abdoulaï, Camara / Kamara),
// "proche" (tous les mots du plus court retrouvés, à une faute près, au moins
// 2), "partiel" (un mot en commun), "" (rien en commun).
function comparerNoms(motsA, motsB) {
  if (cleSonoreNom(motsA) === cleSonoreNom(motsB)) return "sonore";
  const communs = motsCommuns(motsA, motsB);
  const court = Math.min(motsA.length, motsB.length);
  if (court >= 2 && communs === court) return "proche";
  return communs ? "partiel" : "";
}

// Dates : "egale", "proche" (même année et même mois ou même jour, jour et
// mois inversés, ou seule l'année diffère : faute de frappe probable),
// "differente", "" (une des deux inconnue).
function comparerDates(a, b) {
  const x = dateIso(a);
  const y = dateIso(b);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(x) || !iso.test(y)) return "";
  if (x === y) return "egale";
  const [ax, mx, jx] = x.split("-");
  const [ay, my, jy] = y.split("-");
  const memeAnnee = ax === ay && (mx === my || jx === jy || (mx === jy && jx === my));
  return memeAnnee || (mx === my && jx === jy) ? "proche" : "differente";
}

// Filiation : mots des parents DGECS (père, mère) retrouvés dans la filiation
// d'EduGest (ou son tuteur). "egale" : au moins les 3/4, et 2 mots dès que
// DGECS en donne 2 ; "proche" : un mot ; "differente" : aucun alors que la
// filiation d'EduGest est remplie ; "" : rien à comparer. Le tuteur peut être
// un oncle : il confirme, il ne contredit jamais.
function comparerFiliations(motsDgecs, motsFil, motsTuteur) {
  if (!motsDgecs.length) return "";
  const communs = motsCommuns(motsDgecs, [...motsFil, ...motsTuteur]);
  if (communs >= Math.min(2, motsDgecs.length) && communs / motsDgecs.length >= 0.75) return "egale";
  if (communs) return "proche";
  return motsFil.length >= 2 ? "differente" : "";
}

// Ce qui rapproche (ou sépare) deux fiches, en codes traduits par l'écran
// (dgecs.import.evidence.*).
const PREUVES = {
  nom: { identique: "nomIdentique", sonore: "nomEcritAutrement", proche: "nomProche", partiel: "nomPartiel" },
  date: { egale: "dateEgale", proche: "dateProche", differente: "dateDifferente" },
  filiation: { egale: "filiationEgale", proche: "filiationProche", differente: "filiationDifferente" },
};
const preuvesDe = (ind) => ["nom", "date", "filiation"].map((k) => PREUVES[k][ind[k]]).filter(Boolean);

// Force d'un rapprochement :
//  3 = sûr : nom identique ou proche, confirmé par la date de naissance ou la
//      filiation, rien de contraire ;
//  2 = par le nom seul : même nom (à l'orthographe près), aucune date pour
//      confirmer ou contredire, filiation pas contraire ;
//  1 = à montrer, rien d'office : même nom malgré une différence, nom proche,
//      un mot du nom + même date ou même filiation (frère ? jumeau ?), ou
//      même date ET même filiation sous un autre nom ;
//  0 = sans rapport.
function force({ nom: n, date, filiation }) {
  const nom = n === "sonore" ? "identique" : n;
  const contraire = date === "differente" || filiation === "differente";
  const confirme = date === "egale" || filiation === "egale";
  if (!contraire && (nom === "identique" || nom === "proche") && confirme) return 3;
  if (nom === "identique" && !date && !contraire) return 2;
  if (nom === "identique") return 1;
  if (nom === "proche" && !contraire) return 1;
  if (nom === "partiel" && !contraire && confirme) return 1;
  if (date === "egale" && filiation === "egale") return 1;
  return 0;
}

// Élèves d'EduGest qui pourraient être la ligne DGECS `d`, du plus sûr au
// moins sûr.
function candidatsDe(d, fiches) {
  const cleD = cleNomComplet(d.nom, d.prenom);
  const motsD = motsNom(d.nom, d.prenom);
  const filD = motsFiliation(d.pere, d.mere);
  const trouves = [];
  for (const f of fiches) {
    const nom = f.cle === cleD ? "identique" : comparerNoms(motsD, f.mots);
    const date = comparerDates(d.dateNaissance, f.eleve.dateNaissance);
    if (!nom && date !== "egale") continue;
    const ind = { nom, date, filiation: comparerFiliations(filD, f.fil, f.tuteur) };
    const fo = force(ind);
    if (fo) trouves.push({ eleve: f.eleve, ...ind, force: fo, preuves: preuvesDe(ind) });
  }
  return trouves.sort((a, b) => b.force - a.force);
}

// États d'une ligne DGECS face aux élèves d'EduGest :
//  - deja       : un élève d'EduGest porte déjà ce matricule — rien à faire ;
//  - rattacher  : retrouvé, sans matricule — on le lui pose. `sur` : confirmé
//                 par la date de naissance ou la filiation ; `orthographe` :
//                 nom écrit autrement dans EduGest ; `preuves` : pourquoi ;
//  - conflit    : retrouvé, mais avec un AUTRE matricule ;
//  - aVerifier  : peut-être un élève d'EduGest (`candidats` : [{ eleve,
//                 preuves, force }]) — rien d'office, l'écran fait choisir ;
//  - nouveau    : aucun élève d'EduGest ne s'en approche (nom, date de
//                 naissance, filiation) — à inscrire ;
//  - invalide   : ligne inutilisable (sans matricule ou sans nom).
// `eleves` : les élèves d'EduGest qu'on peut rattacher (la section choisie) ;
// `tous` : toute l'école, pour reconnaître un matricule déjà donné ailleurs.
// Une fiche EduGest ne sert qu'à une ligne : les rapprochements sûrs passent
// d'abord, puis ceux par le nom seul ; le reste est à vérifier ou nouveau.
export function rapprocherDgecs(listeDgecs, eleves = [], { tous = eleves } = {}) {
  const parIen = new Map();
  for (const e of tous) {
    const m = normaliserMatriculeDgecs(e.ien);
    if (m && !parIen.has(m)) parIen.set(m, e);
  }
  const pris = new Set();
  const res = listeDgecs.map((d) => {
    if (d.erreurs.length) return { ...d, etat: "invalide" };
    const meme = parIen.get(d.matricule);
    if (!meme) return null;
    pris.add(meme._id);
    return { ...d, etat: "deja", eleve: meme };
  });

  const fiches = eleves.filter((e) => !pris.has(e._id)).map((e) => ({
    eleve: e, cle: cleNomComplet(e.nom, e.prenom), mots: motsNom(e.nom, e.prenom),
    fil: motsFiliation(e.filiation), tuteur: motsFiliation(e.tuteur),
  }));
  const candidats = listeDgecs.map((d, i) => (res[i] ? [] : candidatsDe(d, fiches)));
  const libres = (i) => candidats[i].filter((c) => !pris.has(c.eleve._id));
  const poser = (i, c) => {
    pris.add(c.eleve._id);
    const ligne = { ...listeDgecs[i], eleve: c.eleve, preuves: c.preuves, orthographe: c.nom !== "identique" };
    res[i] = normaliserMatriculeDgecs(c.eleve.ien)
      ? { ...ligne, etat: "conflit" }
      : { ...ligne, etat: "rattacher", sur: c.force === 3 };
  };

  // 1. Un seul candidat sûr. Une fiche prise peut en libérer une autre ligne
  //    (deux candidats sûrs dont l'un part ailleurs) : on recommence.
  for (let change = true; change;) {
    change = false;
    listeDgecs.forEach((_, i) => {
      if (res[i]) return;
      const surs = libres(i).filter((c) => c.force === 3);
      if (surs.length === 1) { poser(i, surs[0]); change = true; }
    });
  }
  // 2. Un seul homonyme (à l'orthographe près), que rien ne confirme ni ne
  //    contredit.
  listeDgecs.forEach((_, i) => {
    if (res[i]) return;
    const restants = libres(i);
    const memeNom = restants.filter((c) => c.nom === "identique" || c.nom === "sonore");
    if (!restants.some((c) => c.force === 3) && memeNom.length === 1 && memeNom[0].force === 2) poser(i, memeNom[0]);
  });
  // 3. Le reste.
  return listeDgecs.map((d, i) => {
    if (res[i]) return res[i];
    const restants = libres(i);
    return restants.length ? { ...d, etat: "aVerifier", candidats: restants } : { ...d, etat: "nouveau" };
  });
}

// Élèves d'EduGest de la classe choisie que la liste DGECS ne contient pas :
// à inscrire sur la plateforme (sans matricule, l'élève est déclaré
// redoublant). Un élève qui POURRAIT être une ligne de la liste (nom proche,
// même date ou même filiation : candidat d'une ligne « à vérifier ») n'y
// figure pas : on ne le déclare pas absent avant de l'avoir vérifié.
export function absentsDeDgecs(lignes, elevesClasse = []) {
  const vus = new Set();
  for (const l of lignes) {
    if (l.eleve) vus.add(l.eleve._id);
    for (const c of l.candidats || []) vus.add(c.eleve._id);
  }
  const matricules = new Set(lignes.map((l) => l.matricule).filter(Boolean));
  return elevesClasse.filter((e) => !vus.has(e._id) && !matricules.has(normaliserMatriculeDgecs(e.ien)));
}

// Ce qui est coché d'office : les rattachements et les nouveaux élèves.
export const cocheParDefaut = (l) => l.etat === "rattacher" || l.etat === "nouveau";

// Fiche EduGest d'un élève de la liste DGECS (le matricule EduGest, propre à
// l'école, est donné par l'écran qui inscrit).
export function ficheDepuisDgecs(d, { classe }) {
  return {
    nom: d.nom, prenom: d.prenom, sexe: d.sexe || "M", classe,
    dateNaissance: d.dateNaissance, lieuNaissance: d.lieuNaissance,
    ien: d.matricule, filiation: d.filiation,
    tuteur: d.pere || d.mere || "", contactTuteur: d.telephone || "",
    statut: "Actif",
  };
}

// Compteurs pour l'aperçu.
export function resumeRapprochement(lignes) {
  const r = { deja: 0, rattacher: 0, conflit: 0, aVerifier: 0, nouveau: 0, invalide: 0 };
  for (const l of lignes) r[l.etat] = (r[l.etat] || 0) + 1;
  return r;
}
