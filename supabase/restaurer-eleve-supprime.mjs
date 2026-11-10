// ════════════════════════════════════════════════════════════════════════
//  Restauration : notes, appréciations et archive 2025-2026 d'un élève supprimé
// ════════════════════════════════════════════════════════════════════════
// Supprimer une fiche élève emporte ses notes et ses appréciations (cascade).
// À La Citadelle, des fiches ont été supprimées en 2026 :
//  • puis RECRÉÉES le même jour pour changer l'enfant de classe : la nouvelle
//    fiche n'a ni ses notes de 2025-2026 ni son archive de l'année → mode
//    « rattacher » (--vers) ;
//  • pour un enfant vraiment parti : il disparaît de 2025-2026, où il était
//    pourtant un élève comme les autres → mode « recréer » (--recreer), la
//    fiche revient partie à la date indiquée ;
//  • dans l'ancien Firestore, avant la migration : il ne reste que ses notes
//    (eleveNom) → mode « recréer depuis Firestore » (--firestore).
//
// Sources : la dernière sauvegarde locale où figure la fiche supprimée
// (backup-donnees.mjs), et l'ancien Firestore (état de fin 2025-2026) pour la
// classe de l'année — mêmes correspondances que reparer-instantanes-2025-2026.
//  • notes et appréciations de l'année : même identifiant, même contenu, seul
//    eleve_id change ; ce qui est déjà là n'est pas réécrit (relancer ne
//    duplique rien) ;
//  • archive : l'instantané de la fiche supprimée (scolarité figée à la
//    clôture) avec la classe de fin d'année. En mode rattacher, un instantané
//    déjà présent est gardé ; sa classe doit être la même, sinon rien n'est
//    écrit — sauf avec --corriger-classe (doublon préinscrit dans la classe
//    suivante, notes saisies sur l'autre fiche).
//  • départ (modes recréer) : statut et date de départ ; une date dans
//    l'année suivante laisse l'élève normal dans les archives de 2025-2026
//    (derniereAnneeFrequentee). Le motif reste à saisir par l'école.
//
// Usage (DRY-RUN sans --executer) :
//   … --supprime <uuid> --vers <uuid> [--corriger-classe]
//   … --supprime <uuid> --recreer --depart AAAA-MM-JJ [--statut Abandonné]
//   … --firestore <id élève Firestore> --nom X --prenom Y --classe "Classe de l'année" --depart AAAA-MM-JJ [--statut Abandonné]
// Sauvegardes : EDUGEST_BACKUP_DIR, sinon C:/Users/ADMIN/edugest-backups.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import cfg from "./config.local.mjs";
import { createClient } from "@supabase/supabase-js";
import { lecteurFirestore } from "./_firestore-lecture.mjs";
import { STATUTS_SORTIE, getSectionForClasse } from "../src/constants.js";
import { lireDate } from "../src/depart-utils.js";

const sb = createClient(cfg.url, cfg.serviceRole);
const args = process.argv.slice(2);
const arg = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const EXECUTER = args.includes("--executer");
const CORRIGER_CLASSE = args.includes("--corriger-classe");
const SUPPRIME = arg("--supprime");
const VERS = arg("--vers");
const RECREER = args.includes("--recreer");
const FIRESTORE = arg("--firestore");
const DEPART = arg("--depart");
const STATUT = arg("--statut") || "Abandonné";
const CODE = arg("--ecole") || "citadelle";
const ANNEE = "2025-2026";
const SAUVEGARDES = process.env.EDUGEST_BACKUP_DIR || "C:/Users/ADMIN/edugest-backups";

const CORRESPONDANCES = {
  citadelle: { "Maternelle A": "Petite Section A", "Maternelle B": "Moyenne Section A", "Maternelle D": "Grande Section A" },
};
const t = (v) => String(v || "").trim();
const stop = (message) => { console.error(`⛔ ${message}`); process.exit(1); };
// Identifiant stable tiré d'un identifiant Firestore : relancer retrouve les
// mêmes lignes au lieu d'en créer d'autres.
const uuidDe = (cle) => {
  const h = crypto.createHash("sha1").update(cle).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const mode = VERS ? "rattacher" : RECREER ? "recreer" : FIRESTORE ? "firestore" : null;
if (!mode || (mode !== "firestore" && !SUPPRIME)) stop("Indiquez --supprime <uuid> avec --vers <uuid> ou --recreer, ou bien --firestore <id>.");
if (mode !== "rattacher") {
  if (!STATUTS_SORTIE.includes(STATUT)) stop(`Statut de départ inconnu : ${STATUT} (${STATUTS_SORTIE.join(", ")}).`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(DEPART || "") || !lireDate(DEPART)) stop("Indiquez --depart AAAA-MM-JJ.");
}

const { data: ecole, error: eEcole } = await sb.from("ecoles").select("id, nom, extra").eq("code", CODE).single();
if (eEcole) stop(`École introuvable : ${eEcole.message}`);
const lireFirestore = await lecteurFirestore(CODE);
const classeReelle = (c) => (CORRESPONDANCES[CODE] || {})[t(c)] || t(c);

// ── Source : fiche supprimée, notes et appréciations de l'année ────────────
let ancienne = null;
let notes = [];
let appreciations = [];
let dossier = "";
let classeAnnee = "";
if (mode === "firestore") {
  classeAnnee = t(arg("--classe"));
  if (!classeAnnee || !t(arg("--nom")) || !t(arg("--prenom"))) stop("Mode Firestore : --nom, --prenom et --classe sont obligatoires.");
  for (const sec of ["Primaire", "College", "Lycee", "Prescolaire"]) {
    for (const n of await lireFirestore(`notes${sec}`)) {
      if (n.eleveId !== FIRESTORE || n.annee !== ANNEE) continue;
      notes.push({
        id: uuidDe(`firestore-note:${n._id}`),
        ecole_id: ecole.id,
        section: getSectionForClasse(classeAnnee),
        matiere: n.matiere,
        type: n.type || null,
        periode: n.periode,
        note: n.note,
        annee: ANNEE,
        enseignant_id: null,
        enseignant_nom: n.enseignantNom || null,
        created_at: n.createdAt ? new Date(n.createdAt).toISOString() : null,
      });
    }
  }
  if (!notes.length) stop(`Aucune note ${ANNEE} pour l'élève Firestore ${FIRESTORE}.`);
} else {
  const lireSauvegarde = (d, fichier) => {
    const p = path.join(SAUVEGARDES, d, fichier);
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, "utf8"));
    return Array.isArray(j) ? j : (j.rows || j.data || []);
  };
  const dossiers = fs.readdirSync(SAUVEGARDES).filter((d) => d.startsWith("backup-") && !d.includes("INCOMPLET")).sort().reverse();
  for (const d of dossiers) {
    const fiche = lireSauvegarde(d, "eleves.json").find((e) => e.id === SUPPRIME && e.ecole_id === ecole.id);
    if (!fiche) continue;
    ancienne = fiche;
    dossier = d;
    notes = lireSauvegarde(d, "notes.json").filter((n) => n.eleve_id === SUPPRIME && n.annee === ANNEE);
    appreciations = lireSauvegarde(d, "appreciations.json").filter((a) => a.eleve_id === SUPPRIME && a.annee === ANNEE);
    break;
  }
  if (!ancienne) stop(`Fiche ${SUPPRIME} absente de toutes les sauvegardes de ${SAUVEGARDES}.`);
  const fid = ancienne.extra?.firestore_id;
  if (fid) {
    for (const sec of ["Primaire", "College", "Lycee", "Prescolaire"]) {
      const doc = (await lireFirestore(`eleves${sec}`)).find((d) => d._id === fid);
      if (doc) { classeAnnee = classeReelle(doc.classe); break; }
    }
  }
  if (!classeAnnee) stop("Classe de fin d'année introuvable dans l'ancien Firestore.");
  // En mode recréer, la fiche revient sous son identifiant : sa présence dit
  // seulement que c'est déjà fait (voir `existe`).
  const { data: encore } = await sb.from("eleves").select("id").eq("id", SUPPRIME);
  if (encore?.length && mode === "rattacher") stop("La fiche « supprimée » existe toujours : rien à restaurer.");
}
const sectionAnnee = getSectionForClasse(classeAnnee);
const sectionsSource = [...new Set([...notes, ...appreciations].map((n) => n.section))];
if (sectionsSource.some((s) => s !== sectionAnnee)) stop(`Notes en section ${sectionsSource.join("/")}, classe ${classeAnnee} en ${sectionAnnee}.`);

// ── Fiche cible ────────────────────────────────────────────────────────────
let cible = null; // fiche actuelle (rattacher) ou fiche à créer (recréer)
let existe = false;
if (mode === "rattacher") {
  const { data, error } = await sb.from("eleves")
    .select("id, ecole_id, prenom, nom, matricule, section, classe, statut, extra, updated_at").eq("id", VERS).single();
  if (error || data.ecole_id !== ecole.id) stop(`Fiche actuelle ${VERS} introuvable dans ${ecole.nom}.`);
  cible = data;
  existe = true;
} else {
  const id = mode === "recreer" ? SUPPRIME : uuidDe(`firestore-eleve:${FIRESTORE}`);
  const { data: deja } = await sb.from("eleves").select("id, prenom, nom, matricule, section, classe, statut, extra, updated_at").eq("id", id);
  existe = !!deja?.length;
  cible = existe ? deja[0] : null;
  if (!existe) {
    let base;
    let snap;
    if (mode === "recreer") {
      base = { ...ancienne };
      delete base.created_at;
      delete base.updated_at;
      snap = ancienne.extra?.historique?.[ANNEE];
      if (!snap) stop(`La fiche supprimée n'a pas d'archive ${ANNEE}.`);
    } else {
      base = { id, ecole_id: ecole.id, nom: t(arg("--nom")), prenom: t(arg("--prenom")), extra: { firestore_id: FIRESTORE } };
      // Pas de fiche : la scolarité de l'année prend la forme de celle des
      // camarades (même clôture), rien de payé connu.
      let modele = null;
      for (let de = 0; !modele; de += 1000) {
        const { data, error } = await sb.from("eleves").select("extra").eq("ecole_id", ecole.id).order("id").range(de, de + 999);
        if (error) stop(`Lecture des élèves : ${error.message}`);
        modele = data.map((e) => e.extra?.historique?.[ANNEE]).find((s) => t(s?.classe) === classeAnnee) || null;
        if (data.length < 1000) break;
      }
      if (!modele) stop(`Aucun camarade de ${classeAnnee} en ${ANNEE} pour modèle d'archive.`);
      snap = {
        classe: classeAnnee,
        clotureLe: modele.clotureLe || null,
        mens: Object.fromEntries(Object.keys(modele.mens || {}).map((m) => [m, "Impayé"])),
        mensDates: {},
        mensMontants: {},
        fraisPayes: {},
        autrePayee: false,
        autreDate: null,
        inscriptionPayee: false,
        inscriptionDate: null,
        typeInscription: modele.typeInscription || null,
      };
    }
    const extra = { ...(base.extra || {}) };
    extra.historique = {
      ...(extra.historique || {}),
      [ANNEE]: {
        ...snap,
        classe: classeAnnee,
        ...(t(snap.classe) !== classeAnnee ? { classeAvantCorrection: snap.classe } : {}),
        restaureDe: mode === "recreer" ? { eleveId: SUPPRIME, sauvegarde: dossier } : { firestoreId: FIRESTORE },
        restaureLe: new Date().toISOString(),
      },
    };
    extra.dateDepart = DEPART;
    extra.motifDepart = null;
    extra.destinationDepart = null;
    // Une fiche partie garde sa dernière classe ; recréée sans fiche, celle de l'année.
    const classe = mode === "recreer" ? base.classe : classeAnnee;
    cible = { ...base, classe, section: mode === "recreer" ? base.section : sectionAnnee, statut: STATUT, extra };
  }
}

// ── Ce qui est déjà là ─────────────────────────────────────────────────────
const idCible = cible.id;
const dejaPresentes = async (table, lignes) => {
  if (!lignes.length) return [];
  const { data, error } = await sb.from(table).select("id, eleve_id").in("id", lignes.map((l) => l.id));
  if (error) stop(`Lecture ${table} : ${error.message}`);
  const ailleurs = data.filter((l) => l.eleve_id !== idCible);
  if (ailleurs.length) stop(`${ailleurs.length} ligne(s) ${table} de la source existent déjà sur une autre fiche.`);
  return data.map((l) => l.id);
};
const notesLa = await dejaPresentes("notes", notes);
const appLa = await dejaPresentes("appreciations", appreciations);
let appreciationsAInserer = appreciations.filter((a) => !appLa.includes(a.id));
if (existe) {
  const { data: nActuelles, error } = await sb.from("notes").select("id").eq("eleve_id", idCible).eq("annee", ANNEE);
  if (error) stop(`Lecture des notes : ${error.message}`);
  const etrangeres = nActuelles.filter((n) => !notes.some((s) => s.id === n.id));
  if (etrangeres.length) stop(`La fiche a déjà ${etrangeres.length} note(s) ${ANNEE} d'ailleurs : restauration refusée pour ne rien mélanger.`);
  const { data: aActuelles, error: eA } = await sb.from("appreciations").select("id, periode").eq("eleve_id", idCible).eq("annee", ANNEE);
  if (eA) stop(`Lecture des appréciations : ${eA.message}`);
  const occupees = aActuelles.filter((a) => !appreciations.some((s) => s.id === a.id)).map((a) => a.periode);
  if (occupees.length) {
    console.log(`  ⚠️ appréciation déjà écrite pour ${occupees.join(", ")} : gardée, celle de la sauvegarde n'est pas reprise`);
    appreciationsAInserer = appreciationsAInserer.filter((a) => !occupees.includes(a.periode));
  }
}
const notesAInserer = notes.filter((n) => !notesLa.includes(n.id));

let snapActuel = null;
let classeACorriger = false;
if (mode === "rattacher") {
  snapActuel = cible.extra?.historique?.[ANNEE] || null;
  classeACorriger = !!snapActuel && t(snapActuel.classe) !== classeAnnee;
  if (classeACorriger && !CORRIGER_CLASSE) stop(`Archive ${ANNEE} déjà présente en ${snapActuel.classe}, fin d'année en ${classeAnnee} (--corriger-classe pour la corriger).`);
  if (!snapActuel && !ancienne.extra?.historique?.[ANNEE]) stop(`Ni la fiche actuelle ni la fiche supprimée n'ont d'archive ${ANNEE}.`);
} else if (existe && t(cible.extra?.historique?.[ANNEE]?.classe) !== classeAnnee) {
  stop(`Fiche déjà recréée avec une archive ${ANNEE} en ${cible.extra?.historique?.[ANNEE]?.classe || "—"}.`);
}

// Matières de l'année (réglages figés) : chaque note doit en trouver une.
const matieres = ecole.extra?.reglagesAnnees?.[ANNEE]?.matieres?.[sectionAnnee] || [];
const sansMatiere = notes.filter((n) => !matieres.some((m) => m.nom === n.matiere && (!m.classes?.length || m.classes.includes(classeAnnee))));

const nomCible = `${cible.prenom} ${cible.nom}`;
console.log(EXECUTER ? "⚠️  MODE EXÉCUTION — les données vont être modifiées." : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");
if (ancienne) console.log(`Fiche supprimée : ${ancienne.prenom} ${ancienne.nom} (${ancienne.matricule || "sans matricule"}, ${ancienne.classe}), sauvegarde ${dossier}`);
if (mode === "rattacher") console.log(`Fiche actuelle  : ${nomCible} (${cible.matricule || "sans matricule"}, ${cible.classe}, ${cible.statut})`);
else console.log(`Fiche ${existe ? "déjà recréée" : "à recréer"} : ${nomCible} (${cible.matricule || "sans matricule"}, ${cible.section}/${cible.classe}), ${existe ? cible.statut : `${STATUT} le ${DEPART}`}`);
console.log(`Classe ${ANNEE} : ${classeAnnee} (${sectionAnnee})`);
const parPeriode = {};
for (const n of notes) parPeriode[n.periode] = (parPeriode[n.periode] || 0) + 1;
console.log(`Notes ${ANNEE} : ${notes.length} (${Object.entries(parPeriode).map(([p, c]) => `${p} ${c}`).join(", ")}), ${notesAInserer.length} à rattacher, ${notes.length - notesAInserer.length} déjà rattachée(s)`);
console.log(`Appréciations ${ANNEE} : ${appreciations.length}, ${appreciationsAInserer.length} à rattacher`);
if (sansMatiere.length) console.log(`  ⚠️ ${sansMatiere.length} note(s) sans matière dans les réglages ${ANNEE} : ${[...new Set(sansMatiere.map((n) => n.matiere))].join(", ")}`);
if (mode === "rattacher") {
  console.log(!snapActuel
    ? `Archive ${ANNEE} : reprise de la fiche supprimée, classe ${ancienne.extra.historique[ANNEE].classe} → ${classeAnnee}`
    : classeACorriger ? `Archive ${ANNEE} : gardée, classe ${snapActuel.classe} → ${classeAnnee}` : `Archive ${ANNEE} : déjà présente (${snapActuel.classe}), gardée`);
} else if (!existe) {
  console.log(`Archive ${ANNEE} : ${classeAnnee}${cible.extra.historique[ANNEE].classeAvantCorrection ? ` (au lieu de ${cible.extra.historique[ANNEE].classeAvantCorrection})` : ""}`);
}

if (!EXECUTER) process.exit(0);

// ── Écritures ───────────────────────────────────────────────────────────────
if (mode !== "rattacher" && !existe) {
  const { error } = await sb.from("eleves").insert(cible);
  if (error) stop(`Fiche non recréée : ${error.message}`);
}
if (notesAInserer.length) {
  const { error } = await sb.from("notes").insert(notesAInserer.map((n) => ({ ...n, eleve_id: idCible })));
  if (error) stop(`Notes non écrites : ${error.message}`);
}
if (appreciationsAInserer.length) {
  const { error } = await sb.from("appreciations").insert(appreciationsAInserer.map((a) => ({ ...a, eleve_id: idCible })));
  if (error) stop(`Notes écrites, mais appréciations non écrites (${error.message}) : relancez.`);
}
if (mode === "rattacher" && (!snapActuel || classeACorriger)) {
  const base = snapActuel || ancienne.extra.historique[ANNEE];
  const historique = {
    ...(cible.extra?.historique || {}),
    [ANNEE]: {
      ...base,
      classe: classeAnnee,
      ...(t(base.classe) !== classeAnnee ? { classeAvantCorrection: base.classe } : {}),
      restaureDe: { eleveId: SUPPRIME, matricule: ancienne.matricule || null, sauvegarde: dossier },
      restaureLe: new Date().toISOString(),
    },
  };
  const { data: maj, error } = await sb.from("eleves").update({ extra: { ...cible.extra, historique } })
    .eq("id", idCible).eq("updated_at", cible.updated_at).select("id");
  if (error || !maj?.length) stop(`Notes rattachées, mais archive non écrite (${error?.message || "fiche modifiée entre-temps"}) : relancez.`);
}
const quoi = [
  mode !== "rattacher" && !existe ? `fiche recréée (${STATUT} le ${DEPART})` : "",
  `${notesAInserer.length} note(s)`,
  appreciationsAInserer.length ? `${appreciationsAInserer.length} appréciation(s)` : "",
  `archive ${ANNEE} en ${classeAnnee}`,
].filter(Boolean).join(", ");
const { error: eJournal } = await sb.from("historique").insert({
  ecole_id: ecole.id,
  extra: {
    action: "Correction des archives",
    details: `${nomCible} : ${quoi}, repris de sa fiche supprimée (${ancienne?.matricule || SUPPRIME || "ancienne base"})`,
    auteur: "Maintenance EduGest",
    date: Date.now(),
  },
});
if (eJournal) console.log(`  (journal non écrit : ${eJournal.message})`);
console.log(`\n✅ ${nomCible} : ${quoi}.`);
process.exit(0);
