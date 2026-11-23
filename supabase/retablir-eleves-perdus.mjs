// ════════════════════════════════════════════════════════════════════════
//  Rétablissement d'élèves perdus : fiche + encaissements
// ════════════════════════════════════════════════════════════════════════
// Un élève inscrit et encaissé peut avoir disparu de deux façons :
//  • son inscription a été refusée par la base à la synchronisation (règle
//    anti-doublon), et ses encaissements avec elle ; l'école a parfois
//    ressaisi la fiche plus tard, sans le reçu, et cette fiche « sans
//    paiement » a ensuite été supprimée comme non réinscrite ;
//  • sa fiche a été supprimée et, avant le 2026-11-07, ses lignes de caisse
//    sont parties avec elle (cascade).
// Il reste la trace au journal (« Versement encaissé ») et la fiche dans les
// sauvegardes locales ou dans l'instantané de la suppression (historique).
//
// Ce script lit un PLAN (JSON, hors dépôt : données réelles d'élèves) :
//   [{ eleveId, fiche (ligne `eleves` d'une sauvegarde) | null,
//      encaissement: { journalId, dateAppareil, auteur, total,
//                      lignes: [{ type, mois, libelle, montant }] },
//      lignesVuesEnSauvegarde: [lignes `paiements` d'origine] }]
// et, pour chaque élève :
//  • refuse si la fiche existe déjà (déjà rétabli), si le code élève est pris
//    par une autre fiche, si un élève de même nom et même filiation existe
//    (ressaisi entre-temps : à ne pas doubler), ou s'il a déjà des lignes de
//    caisse ;
//  • remet la fiche sous SON identifiant, dans sa classe, marquée payée pour
//    ce qui a été encaissé (mens, dates, montants, inscription) ;
//  • remet les lignes de caisse : celles vues en sauvegarde à l'identique,
//    sinon reconstruites depuis le journal, à la date de l'encaissement
//    (identifiant stable : relancer ne duplique rien) ;
//  • écrit « Élève rétabli » à l'historique.
//
// Usage (DRY-RUN sans --executer) :
//   node supabase/retablir-eleves-perdus.mjs --plan <plan.json> [--seul <début d'id>] [--executer]
import crypto from "node:crypto";
import fs from "node:fs";
import cfg from "./config.local.mjs";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(cfg.url, cfg.serviceRole);
const args = process.argv.slice(2);
const arg = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : null; };
const EXECUTER = args.includes("--executer");
const PLAN = arg("--plan");
const SEUL = arg("--seul");
const stop = (message) => { console.error(`⛔ ${message}`); process.exit(1); };
if (!PLAN || !fs.existsSync(PLAN)) stop("Indiquez --plan <fichier.json>.");

const t = (v) => String(v ?? "").trim();
// Mêmes clés que eleve_cle_texte / eleve_cle_filiation (base) : sans accents,
// majuscules, ponctuation retirée ; filiation sans père/mère/fils/fille/de/du/d/et.
const cle = (v) => t(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase()
  .replace(/[^A-Z0-9]+/g, " ").trim();
const MOTS_FILIATION = new Set(["PERE", "MERE", "FILS", "FILLE", "DE", "DU", "D", "ET"]);
const cleFiliation = (v) => cle(v).split(" ").filter((m) => m && !MOTS_FILIATION.has(m)).join(" ");
const uuidDe = (texte) => {
  const h = crypto.createHash("sha1").update(texte).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const jjmmaaaa = (iso) => { const [a, m, j] = iso.slice(0, 10).split("-"); return `${j}/${m}/${a}`; };

// Instantané de suppression (format de l'application, camelCase) → ligne `eleves`.
const COLONNES = {
  section: "section", nom: "nom", prenom: "prenom", sexe: "sexe", matricule: "matricule", ien: "ien",
  classe: "classe", dateNaissance: "date_naissance", lieuNaissance: "lieu_naissance", filiation: "filiation",
  tuteur: "tuteur", contactTuteur: "contact_tuteur", domicile: "domicile", photo: "photo", statut: "statut",
};
function ligneDepuisInstantane(id, ecoleId, donnees, creeLe) {
  const ligne = { id, ecole_id: ecoleId, extra: {} };
  for (const [k, v] of Object.entries(donnees || {})) {
    if (k === "_id" || k === "id") continue;
    if (COLONNES[k]) ligne[COLONNES[k]] = v;
    else ligne.extra[k] = v;
  }
  if (creeLe) ligne.created_at = creeLe;
  return ligne;
}

const plan = JSON.parse(fs.readFileSync(PLAN, "utf8")).filter((p) => !SEUL || p.eleveId.startsWith(SEUL));
if (!plan.length) stop("Aucun élève dans le plan (ou --seul ne correspond à rien).");
console.log(EXECUTER ? "⚠️  MODE EXÉCUTION — les données vont être modifiées." : "🔎 DRY-RUN — aucune écriture. Ajoutez --executer pour appliquer.");

let faits = 0;
for (const p of plan) {
  const base = p.fiche
    ? (({ updated_at, ...reste }) => reste)(p.fiche)
    : ligneDepuisInstantane(p.eleveId, p.ecoleId, p.instantane, p.creeLe);
  const nom = `${t(base.nom)} ${t(base.prenom)}`.trim();
  const etiquette = `${nom} (${base.classe || "sans classe"}, ${base.matricule || "sans code"})`;
  console.log(`\n── ${etiquette}`);
  if (!t(base.classe)) { console.log("  ⛔ pas de classe connue : à compléter par l'école"); continue; }

  const { data: ecole, error: eEcole } = await sb.from("ecoles").select("id, nom, extra").eq("id", base.ecole_id).single();
  if (eEcole) { console.log(`  ⛔ école introuvable : ${eEcole.message}`); continue; }
  const annee = ecole.extra?.anneeScolaire;
  if (!annee) { console.log("  ⛔ année scolaire de l'école inconnue"); continue; }

  // ── Ce qui est déjà en base ───────────────────────────────────────────────
  const { data: deja } = await sb.from("eleves").select("id").eq("id", p.eleveId);
  if (deja?.length) { console.log("  ✔ fiche déjà présente : rien à faire"); continue; }
  let freres = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await sb.from("eleves")
      .select("id, nom, prenom, filiation, matricule, classe, statut").eq("ecole_id", base.ecole_id).order("id").range(de, de + 999);
    if (error) stop(`Lecture des élèves : ${error.message}`);
    freres = freres.concat(data);
    if (data.length < 1000) break;
  }
  const codePris = t(base.matricule) && freres.find((e) => cle(e.matricule).replace(/ /g, "") === cle(base.matricule).replace(/ /g, ""));
  if (codePris) { console.log(`  ⛔ code élève ${base.matricule} déjà pris par ${codePris.nom} ${codePris.prenom} (${codePris.classe})`); continue; }
  const filiation = cleFiliation(base.filiation);
  const ressaisi = freres.filter((e) => cle(e.nom) === cle(base.nom) && cle(e.prenom) === cle(base.prenom)
    && filiation && cleFiliation(e.filiation) === filiation);
  if (ressaisi.length) { console.log(`  ⏭ déjà ressaisi : ${ressaisi.map((e) => `${e.classe} ${e.matricule}`).join(", ")} — ignoré`); continue; }
  const { data: lignesLa, error: eLignes } = await sb.from("paiements").select("id").eq("eleve_id", p.eleveId);
  if (eLignes) stop(`Lecture de la caisse : ${eLignes.message}`);
  if (lignesLa.length) { console.log(`  ⛔ ${lignesLa.length} ligne(s) de caisse déjà sur cet identifiant`); continue; }

  // ── Lignes de caisse ──────────────────────────────────────────────────────
  const enc = p.encaissement;
  const dateEnc = enc.dateAppareil;
  const vues = (p.lignesVuesEnSauvegarde || []).filter((l) => l.statut === "encaisse");
  const lignes = vues.length
    ? vues.map(({ updated_at, ...l }) => ({ ...l, extra: { ...(l.extra || {}), retabli: { le: new Date().toISOString(), source: "sauvegarde" } } }))
    : enc.lignes.map((l) => ({
      id: uuidDe(`retablissement:${enc.journalId}:${l.type}:${l.mois}`),
      ecole_id: base.ecole_id,
      eleve_id: p.eleveId,
      mois: l.mois,
      statut: "encaisse",
      montant: l.montant,
      date_paiement: dateEnc.slice(0, 10),
      created_at: dateEnc,
      annee,
      type: l.type,
      libelle: l.libelle,
      eleve_nom: nom,
      classe: base.classe,
      auteur: enc.auteur || "",
      extra: { retabli: { le: new Date().toISOString(), source: "journal", journalId: enc.journalId } },
    }));
  const totalLignes = lignes.reduce((a, l) => a + Number(l.montant), 0);
  if (totalLignes !== Number(enc.total)) { console.log(`  ⛔ lignes (${totalLignes}) ≠ reçu (${enc.total})`); continue; }

  // ── Fiche marquée payée pour ce qui a été encaissé ────────────────────────
  const extra = { ...(base.extra || {}) };
  extra.mens = { ...(extra.mens || {}) };
  extra.mensDates = { ...(extra.mensDates || {}) };
  extra.mensMontants = { ...(extra.mensMontants || {}) };
  for (const l of lignes) {
    const jour = jjmmaaaa(l.created_at || dateEnc);
    if (l.type === "mensualite") {
      extra.mens[l.mois] = "Payé";
      extra.mensDates[l.mois] = jour;
      extra.mensMontants[l.mois] = Number(l.montant);
    } else if (l.type === "inscription") {
      extra.inscriptionPayee = true;
      extra.inscriptionDate = jour;
      extra.inscriptionMontant = Number(l.montant);
      extra.inscriptionAcompte = null;
      extra.typeInscription = /^r/i.test(t(l.libelle)) ? "Réinscription" : "Inscription";
    }
  }
  extra.retabli = {
    le: new Date().toISOString(),
    par: "Maintenance EduGest",
    raison: p.raison || "inscrit et encaissé, fiche perdue",
    journalId: enc.journalId,
  };
  const fiche = { ...base, statut: "Actif", extra };

  console.log(`  fiche : ${p.fiche ? `sauvegarde ${p.sauvegarde}` : "instantané de la suppression"} → ${fiche.statut}, ${fiche.classe}`);
  console.log(`  caisse : ${lignes.length} ligne(s) ${vues.length ? "d'origine (sauvegarde)" : "reconstruites du journal"}, ${totalLignes} GNF le ${dateEnc.slice(0, 10)} — ${lignes.map((l) => `${l.libelle} ${l.montant}`).join(", ")}`);
  if (!EXECUTER) continue;

  // ── Écritures ─────────────────────────────────────────────────────────────
  const { error: eFiche } = await sb.from("eleves").insert(fiche);
  if (eFiche) { console.log(`  ⛔ fiche non rétablie : ${eFiche.message}`); continue; }
  const { error: ePay } = await sb.from("paiements").upsert(lignes, { onConflict: "id", ignoreDuplicates: true });
  if (ePay) { console.log(`  ⛔ fiche rétablie, mais caisse non écrite (${ePay.message}) : relancez`); continue; }
  const { error: eJournal } = await sb.from("historique").insert({
    ecole_id: base.ecole_id,
    extra: {
      action: "Élève rétabli",
      details: `${nom} (${fiche.classe}, ${fiche.matricule || "sans code"}) — fiche perdue, rétablie avec son reçu du ${jjmmaaaa(dateEnc)} : ${lignes.map((l) => `${l.libelle} ${l.montant.toLocaleString("fr-FR")} GNF`).join(", ")}`,
      auteur: "Maintenance EduGest",
      date: Date.now(),
    },
  });
  if (eJournal) console.log(`  (historique non écrit : ${eJournal.message})`);
  console.log("  ✅ rétabli");
  faits += 1;
}
console.log(`\n${EXECUTER ? `✅ ${faits} élève(s) rétabli(s).` : "Fin du DRY-RUN."}`);
process.exit(0);
