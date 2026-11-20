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

// Même personne, quel que soit l'ordre des mots : « BARRY Mamadou Aliou » et
// « Mamadou Aliou BARRY » donnent la même clé.
export const cleNomComplet = (nom, prenom) => cle(`${nom} ${prenom}`).split(" ").filter(Boolean).sort().join(" ");
const cleFiliation = (f) => cle(f).split(" ").filter((m) => m && !["pere", "mere", "fils", "fille", "de", "d", "du", "et"].includes(m)).join(" ");

// États d'une ligne DGECS face aux élèves d'EduGest :
//  - deja       : un élève d'EduGest porte déjà ce matricule — rien à faire ;
//  - rattacher  : retrouvé par son nom, sans matricule — on le lui pose
//                 (`sur` : confirmé par la date de naissance ou la filiation) ;
//  - conflit    : retrouvé par son nom, mais avec un AUTRE matricule ;
//  - aVerifier  : même nom, mais date de naissance différente ou plusieurs
//                 homonymes — rien d'automatique ;
//  - nouveau    : absent d'EduGest — à inscrire ;
//  - invalide   : ligne inutilisable (sans matricule ou sans nom).
// `eleves` : les élèves d'EduGest qu'on peut rattacher (la section choisie) ;
// `tous` : toute l'école, pour reconnaître un matricule déjà donné ailleurs.
export function rapprocherDgecs(listeDgecs, eleves = [], { tous = eleves } = {}) {
  const parIen = new Map();
  for (const e of tous) {
    const m = normaliserMatriculeDgecs(e.ien);
    if (m && !parIen.has(m)) parIen.set(m, e);
  }
  const parNom = new Map();
  for (const e of eleves) {
    const k = cleNomComplet(e.nom, e.prenom);
    if (!k) continue;
    if (!parNom.has(k)) parNom.set(k, []);
    parNom.get(k).push(e);
  }
  const pris = new Set();
  const lignes = listeDgecs.map((d) => {
    if (d.erreurs.length) return { ...d, etat: "invalide" };
    const meme = parIen.get(d.matricule);
    if (meme) { pris.add(meme._id); return { ...d, etat: "deja", eleve: meme }; }
    const candidats = (parNom.get(cleNomComplet(d.nom, d.prenom)) || []).filter((e) => !pris.has(e._id));
    if (!candidats.length) return { ...d, etat: "nouveau" };
    const dateEgale = (e) => !!d.dateNaissance && dateIso(e.dateNaissance) === d.dateNaissance;
    const dateContraire = (e) => !!d.dateNaissance && !!e.dateNaissance && dateIso(e.dateNaissance) !== d.dateNaissance;
    const filiationEgale = (e) => !!cleFiliation(d.filiation) && cleFiliation(e.filiation) === cleFiliation(d.filiation);
    const compatibles = candidats.filter((e) => !dateContraire(e));
    if (compatibles.length !== 1) return { ...d, etat: "aVerifier", candidats };
    const e = compatibles[0];
    pris.add(e._id);
    if (normaliserMatriculeDgecs(e.ien)) return { ...d, etat: "conflit", eleve: e };
    return { ...d, etat: "rattacher", eleve: e, sur: dateEgale(e) || filiationEgale(e) };
  });
  return lignes;
}

// Élèves d'EduGest de la classe choisie que la liste DGECS ne contient pas :
// à inscrire sur la plateforme (sans matricule, l'élève est déclaré redoublant).
export function absentsDeDgecs(lignes, elevesClasse = []) {
  const vus = new Set(lignes.filter((l) => l.eleve).map((l) => l.eleve._id));
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
