// ══════════════════════════════════════════════════════════════
//  Bulletins de paie annuels — registre d'émargement à remplir à la main
// ══════════════════════════════════════════════════════════════
// Un feuillet A4 paysage par enseignant pour TOUTE l'année scolaire :
// imprimé une fois, relié en brochure, rempli à la main par le comptable et
// signé chaque mois par l'enseignant (sa signature vaut reçu du net payé).
//
// L'application n'imprime que ce qui ne bouge pas de l'année : identité,
// classes et volume horaire tirés de l'emploi du temps, taux horaire,
// forfait du primaire. Ce qui change d'un mois à l'autre (5ᵉ semaine, heures
// non faites, avances, retenues, net, dates, signatures) reste en blanc. Si
// un élément fixe change en cours d'année, on réimprime ce seul feuillet.
//
// Style d'apparat partagé avec l'attestation « Diplôme » (./ornements.js) :
// cadre guilloché à la couleur de l'école avec micro-texte de sécurité,
// filets dorés, typographie à empattements ; rien n'est chargé d'Internet et
// la page reste lisible en noir et blanc.
import { TOUS_MOIS_LONGS, fmtN } from "../constants.js";
import { libelleMois, libelleStatutEnseignant } from "../i18n/libelles.js";
import { nomAffiche } from "../ordre-eleves.js";
import {
  buildTeacherFullName,
  getScheduleSlotHours,
  getTeacherScheduleSlots,
  getTeacherWeeklyAmount,
  getWeightedPrimeHoraire,
  normalizeSalaryName,
} from "../salary-utils.js";
import { getTeacherMonthlyForfait } from "../teacher-utils.js";
import { echapper, identiteEcole } from "./bulletins/bulletin-pro-commun.js";
import { OR, OR_FONCE, SERIF, ajusterPagesScript, cadreGuilloche, laurier, monogramme, rosace } from "./ornements.js";
import { PRINT_TRIGGER, edugestBrandHTML, printDir, printLang, printResetFor, tr } from "./print-helpers.js";
import { signatairesDocument } from "./signatures.js";

const k = (cle, opts) => tr(`reports.payBook.${cle}`, opts);
// Cadre A4 paysage, bandes en tracés continus : une brochure de 40 feuillets
// reste légère à envoyer à l'imprimante.
const CADRE = { largeur: 297, hauteur: 210, marge: 5, bande: 2.4, continu: true };
const arrondi1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
const parNom = (a, b) => a.nom.localeCompare(b.nom, "fr", { sensitivity: "base" });
const naturel = (a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" });

// ── Données : ce qui est fixe pour l'année ──────────────────────
// `ensPrimaire` peut contenir la maternelle (groupe de paie « Primaire ») :
// `ensPrescolaire` sert alors seulement à reconnaître ses enseignants.
// `ordreNoms` : réglage Paramètres → Affichage (« NOM Prénom » par défaut),
// qui fixe l'écriture des noms et l'ordre du registre.
export function fichesBulletinsPaie({
  ensCollege = [], ensLycee = [], ensPrimaire = [], ensPrescolaire = [],
  emploisCollege = [], emploisLycee = [], primeDefaut = 0, ordreNoms,
} = {}) {
  // Le nom complet « Prénom NOM » sert aux rapprochements (emploi du temps,
  // doublons) ; le feuillet écrit le nom dans l'ordre choisi par l'école.
  const ecrit = (teacher, complet) => nomAffiche(teacher, ordreNoms) || complet;
  // Secondaire : une même personne au collège ET au lycée n'a qu'un feuillet,
  // avec les heures de ses deux emplois du temps.
  const secondaires = new Map();
  const ajouter = (teacher, emplois, section) => {
    const nom = buildTeacherFullName(teacher);
    const cle = normalizeSalaryName(nom);
    if (!cle) return;
    const creneaux = getTeacherScheduleSlots(emplois, teacher);
    const deja = secondaires.get(cle);
    if (deja) {
      deja.creneaux.push(...creneaux);
      deja.sections.add(section);
      return;
    }
    secondaires.set(cle, { teacher, nom: ecrit(teacher, nom), cle, creneaux: [...creneaux], sections: new Set([section]) });
  };
  ensCollege.forEach((t) => ajouter(t, emploisCollege, "college"));
  ensLycee.forEach((t) => ajouter(t, emploisLycee, "lycee"));

  const heures = [...secondaires.values()].map(({ teacher, nom, cle, creneaux, sections }) => {
    const vhHebdo = arrondi1(creneaux.reduce((s, c) => s + getScheduleSlotHours(c), 0));
    const tauxParClasse = (teacher.primeParClasse || [])
      .filter((p) => p.classe && Number(p.prime) > 0)
      .map((p) => ({ classe: String(p.classe), prime: Number(p.prime) }))
      .sort((a, b) => naturel(a.classe, b.classe));
    return {
      id: teacher._id || cle,
      type: "heures",
      nom,
      sections: [...sections],
      matiere: teacher.matiere || "",
      grade: teacher.grade || "",
      statut: teacher.statut || "",
      telephone: teacher.telephone || "",
      classes: [...new Set(creneaux.map((c) => String(c.classe || "").trim()).filter(Boolean))].sort(naturel),
      vhHebdo,
      vhMois: arrondi1(vhHebdo * 4),
      // Taux unique, ou taux par classe (+ celui des autres classes).
      taux: Number(teacher.primeHoraire || primeDefaut || 0),
      tauxParClasse,
      tauxMoyen: tauxParClasse.length && vhHebdo > 0 ? getWeightedPrimeHoraire(teacher, creneaux, primeDefaut) : 0,
      // 4 semaines au taux de chaque créneau : le brut d'un mois complet.
      montantMois: Math.round(getTeacherWeeklyAmount(teacher, creneaux, primeDefaut) * 4),
    };
  }).sort(parNom);

  const idsMaternelle = new Set(ensPrescolaire.map((t) => t._id).filter(Boolean));
  const vus = new Set();
  const forfaits = (liste, section) => liste.flatMap((teacher) => {
    const nom = buildTeacherFullName(teacher);
    const cle = normalizeSalaryName(nom);
    if (!cle || vus.has(cle)) return [];
    vus.add(cle);
    return [{
      id: teacher._id || cle,
      type: "forfait",
      nom: ecrit(teacher, nom),
      sections: [section],
      matiere: teacher.matiere || "",
      grade: teacher.grade || "",
      statut: teacher.statut || "",
      telephone: teacher.telephone || "",
      classe: teacher.classeTitle || teacher.classe || "",
      salaireMois: getTeacherMonthlyForfait(teacher),
    }];
  }).sort(parNom);
  const primaire = forfaits(ensPrimaire.filter((t) => !idsMaternelle.has(t._id)), "primaire");
  const maternelle = forfaits([
    ...ensPrescolaire,
    ...ensPrimaire.filter((t) => idsMaternelle.has(t._id)),
  ], "prescolaire");

  return [...heures, ...primaire, ...maternelle].map((f, i) => ({ ...f, numero: i + 1 }));
}

// ── Mise en forme ───────────────────────────────────────────────
const libelleSections = (sections) =>
  sections.map((s) => tr(`accounting.sections.${s}`)).join(k("and"));

const gnf = (v) => (Number(v) > 0 ? k("amount", { montant: fmtN(v) }) : "");
const heuresTxt = (v) => (Number(v) > 0 ? k("hours", { n: String(v).replace(".", ",") }) : "");

// Année civile de chaque mois de l'année scolaire « 2026-2027 » :
// septembre → décembre la première, janvier → août la seconde.
const anneeDuMois = (mois, annee) => {
  const [debut, fin] = String(annee || "").split("-").map((a) => a.trim());
  const i = TOUS_MOIS_LONGS.indexOf(mois);
  if (i < 0 || !debut) return "";
  return i < 4 ? debut : (fin || "");
};

// Une rubrique : libellé, conducteur pointillé, valeur. Sans valeur, le
// conducteur court jusqu'au bout : la rubrique se remplit à la main.
const ligne = (label, valeur, classe = "") => {
  const v = String(valeur ?? "").trim();
  return `<div class="ligne${classe ? ` ${classe}` : ""}"><span>${label}</span><b>${echapper(v)}</b></div>`;
};

function tauxTexte(f) {
  if (!f.tauxParClasse.length) return gnf(f.taux);
  const parClasse = f.tauxParClasse.map((p) => `${p.classe} : ${fmtN(p.prime)}`);
  if (f.taux > 0) parClasse.push(k("otherClasses", { montant: fmtN(f.taux) }));
  return `${parClasse.join(" · ")} ${k("currency")}`;
}

function cartes(f, nbMois) {
  const statut = [libelleStatutEnseignant(f.statut), f.grade].filter(Boolean).join(" · ");
  const enseignant = `<div class="carte"><div class="carte-t">${k("teacherCard")}</div><div class="champs">
      ${ligne(k("name"), f.nom, "large nomel")}
      ${ligne(k("section"), libelleSections(f.sections))}
      ${ligne(k("phone"), f.telephone)}
      ${ligne(k("status"), statut, "large")}
    </div></div>`;
  // Grille de trois colonnes : les longues rubriques (classes, taux par
  // classe) prennent la largeur et passent à la ligne au lieu d'être coupées.
  // Taux par classe : sa propre ligne, le taux moyen à côté du brut.
  const parClasse = f.tauxParClasse?.length > 0;
  const fixes = f.type === "heures"
    ? `${ligne(k("subject"), f.matiere)}
       ${ligne(k("weeklyHours"), heuresTxt(f.vhHebdo))}
       ${ligne(k("monthlyHours"), heuresTxt(f.vhMois))}
       ${ligne(k("classes"), f.classes.join(", "), "large longue")}
       ${parClasse
    ? `${ligne(k("ratesByClass"), tauxTexte(f), "large longue")}
       ${ligne(k("averageRate"), gnf(f.tauxMoyen))}
       ${ligne(k("monthlyPlanned"), gnf(f.montantMois), "c2")}`
    : `${ligne(k("hourlyRate"), tauxTexte(f))}
       ${ligne(k("monthlyPlanned"), gnf(f.montantMois), "c2")}`}`
    // Primaire : l'instituteur fait toute sa classe, la matière n'apparaît
    // que si la fiche en porte une.
    : `${ligne(k("homeClass"), f.classe)}
       ${ligne(k("monthlySalary"), gnf(f.salaireMois))}
       ${ligne(k("yearPlanned", { n: nbMois }), gnf(f.salaireMois * nbMois))}
       ${f.matiere ? ligne(k("subject"), f.matiere, "large") : ""}`;
  return `<div class="cartes">${enseignant}
    <div class="carte fixe"><div class="carte-t">${k("fixedCard")}</div><div class="champs">${fixes}</div></div></div>`;
}

// En-têtes de colonnes : [clé, signe, largeur relative, classe].
const COLONNES = {
  heures: {
    groupes: [["hoursGroup", 4], ["salaryGroup", 5], ["signGroup", 3]],
    colonnes: [
      ["colPlanned", "", 11], ["colFifth", "+", 11], ["colNotDone", "−", 11], ["colDone", "=", 11, "fort"],
      ["colGross", "", 21], ["colAdvance", "−", 18], ["colAbsence", "−", 18], ["colRecall", "+", 18], ["colNet", "", 24, "net"],
      ["colDate", "", 16], ["colSignature", "", 36, "sig"], ["colVisa", "", 20],
    ],
  },
  forfait: {
    groupes: [["salaryGroup", 5], ["signGroup", 3]],
    colonnes: [
      ["colMonthSalary", "", 26], ["colAdvance", "−", 22], ["colAbsence", "−", 22], ["colRecall", "+", 22], ["colNet", "", 30, "net"],
      ["colDate", "", 20], ["colSignature", "", 48, "sig"], ["colVisa", "", 26],
    ],
  },
};
const LARGEUR_MOIS = 19;

function tableau(f, mois, annee) {
  const { groupes, colonnes } = COLONNES[f.type];
  const total = LARGEUR_MOIS + colonnes.reduce((s, c) => s + c[2], 0);
  const pct = (l) => `${((l * 100) / total).toFixed(2)}%`;
  const prerempli = f.type === "heures" ? heuresTxt(f.vhMois) : gnf(f.salaireMois);
  // Première colonne : heures prévues (secondaire) ou salaire du mois
  // (primaire), les mêmes chaque mois — imprimées d'avance.
  const cellules = colonnes.map(([, , , cls], j) => {
    const valeur = j === 0 && prerempli ? `<span class="pre">${echapper(prerempli)}</span>` : "";
    return `<td${cls ? ` class="${cls}"` : ""}>${valeur}</td>`;
  }).join("");
  const lignes = mois.map((m) => `<tr><th class="mois" scope="row">${libelleMois(m)}<small>${anneeDuMois(m, annee)}</small></th>${cellules}</tr>`).join("");
  // Total : les colonnes d'argent et d'heures seulement.
  const totaux = colonnes.map(([cle, , , cls]) => (["colDate", "colSignature", "colVisa"].includes(cle)
    ? `<td class="neutre"></td>` : `<td${cls ? ` class="${cls}"` : ""}></td>`)).join("");
  return `<table class="paie">
    <colgroup><col style="width:${pct(LARGEUR_MOIS)}"/>${colonnes.map((c) => `<col style="width:${pct(c[2])}"/>`).join("")}</colgroup>
    <thead>
      <tr class="groupes"><th rowspan="2" class="coin">${k("colMonth")}</th>${groupes.map(([cle, n]) => `<th colspan="${n}">${k(cle)}</th>`).join("")}</tr>
      <tr class="cols">${colonnes.map(([cle, signe, , cls]) => `<th${cls ? ` class="${cls}"` : ""}>${k(cle)}${signe ? `<i>(${signe})</i>` : ""}</th>`).join("")}</tr>
    </thead>
    <tbody>${lignes}<tr class="total"><th scope="row">${k("total")}</th>${totaux}</tr></tbody>
  </table>`;
}

function signaturesHTML(f, schoolInfo) {
  // Titres et noms seulement : un feuillet rempli à la main toute l'année ne
  // porte pas d'avance le cachet ni la signature de la direction.
  const blocs = signatairesDocument(schoolInfo, "etatSalaires")
    .map((s) => ({ titre: s.titre, nom: s.nom, bas: k(s.role === "visa" ? "stampSignature" : "nameSignature") }));
  const enseignant = { titre: k("teacherCard"), nom: f.nom, bas: k("endOfYear") };
  return [enseignant, ...blocs].map((s) => `<div class="sig"><b>${echapper(s.titre)}</b>`
    + `<span class="nom">${echapper(s.nom || "")}</span><div class="trace"></div><small>${s.bas}</small></div>`).join("");
}

function enTete(ecole, schoolInfo) {
  return `<div class="tete">
      <div class="etat">
        <div class="rep">${ecole.pays}</div>
        <div class="dev">${ecole.devise}</div>
        <div class="min">${ecole.ministere}</div>
        ${ecole.tutelle ? `<div class="tut">${ecole.tutelle}</div>` : ""}
      </div>
      <div class="embleme">${laurier(24)}${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : monogramme(schoolInfo.nom)}</div>
      <div class="ecole">
        <div class="nom">${ecole.nom}</div>
        ${[ecole.adresse, ecole.contact].filter(Boolean).length ? `<div class="coord">${[ecole.adresse, ecole.contact].filter(Boolean).join(" · ")}</div>` : ""}
        ${ecole.agrement ? `<div class="coord">${ecole.agrement}</div>` : ""}
      </div>
    </div>`;
}

const filigrane = (ecole) => `<div class="fili" aria-hidden="true">
    <svg viewBox="-60 -60 120 120">${rosace({ n: 48, rCentre: 19, rCercle: 31, epaisseur: 0.16, opacite: 0.1 })}</svg>
    ${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : ""}
  </div>`;

function feuillet(f, { ecole, schoolInfo, annee, mois, total }) {
  const microTexte = echapper(`${schoolInfo.nom || ""} · ${k("title")} · ${annee} · ${f.nom}`.toUpperCase());
  return `<section class="page bp">
    ${cadreGuilloche({ ...CADRE, microTexte })}
    ${filigrane(ecole)}
    <div class="corps"><div class="ajustable">
      ${enTete(ecole, schoolInfo)}
      <div class="titre"><i></i><h1>${k("title")}</h1><i></i></div>
      <div class="numero">${k("yearLine", { annee: echapper(annee) })}${total > 1 ? ` · ${k("sheet", { n: f.numero, total })}` : ""}</div>
      ${cartes(f, mois.length)}
      ${tableau(f, mois, annee)}
      <div class="cloture">
        <div class="arrete"><span>${k("settled")}</span><em></em><span>${k("currency")}</span></div>
        <div class="note">${k("note")}</div>
        <div class="sigs">${signaturesHTML(f, schoolInfo)}</div>
      </div>
    </div></div>
  </section>`;
}

function pageCouverture(fiches, { ecole, schoolInfo, annee, mois }) {
  const compte = (s) => fiches.filter((f) => f.sections.includes(s)).length;
  const repartition = ["college", "lycee", "primaire", "prescolaire"]
    .filter((s) => compte(s) > 0)
    .map((s) => `${tr(`accounting.sections.${s}`)} : <b>${compte(s)}</b>`).join(" · ");
  const debut = mois[0] ? `${libelleMois(mois[0])} ${anneeDuMois(mois[0], annee)}` : "";
  const fin = mois.length ? `${libelleMois(mois[mois.length - 1])} ${anneeDuMois(mois[mois.length - 1], annee)}` : "";
  return `<section class="page bp couv">
    ${cadreGuilloche({ ...CADRE, microTexte: echapper(`${schoolInfo.nom || ""} · ${k("coverTitle")} · ${annee}`.toUpperCase()) })}
    ${filigrane(ecole)}
    <div class="corps">
      <div class="etat couv-etat"><span class="rep">${ecole.pays}</span> · <span class="dev">${ecole.devise}</span></div>
      <div class="couv-centre">
        <div class="embleme grand">${laurier(40)}${ecole.logo ? `<img crossOrigin="anonymous" src="${echapper(ecole.logo)}" alt=""/>` : monogramme(schoolInfo.nom)}</div>
        <div class="couv-ecole">${ecole.nom}</div>
        <div class="titre"><i></i><h1>${k("coverTitle")}</h1><i></i></div>
        <div class="couv-sous">${k("coverStaff")}</div>
        <div class="couv-annee">${k("yearLine", { annee: echapper(annee) })}</div>
        ${debut ? `<div class="couv-periode">${k("period", { debut, fin })}</div>` : ""}
        <div class="couv-compte">${k("sheetsCount", { n: fiches.length })}${repartition ? ` — ${repartition}` : ""}</div>
      </div>
      <div class="couv-pied">${edugestBrandHTML(schoolInfo)}</div>
    </div>
  </section>`;
}

const PAR_COLONNE = 20;
function pagesSommaire(fiches, { schoolInfo, annee }) {
  const pages = [];
  for (let i = 0; i < fiches.length; i += PAR_COLONNE * 2) pages.push(fiches.slice(i, i + PAR_COLONNE * 2));
  const colonne = (liste) => (liste.length ? `<table class="somm"><thead><tr>
      <th class="n">${k("sheetNo")}</th><th>${k("name")}</th><th>${k("section")}</th><th>${k("subjectOrClass")}</th></tr></thead><tbody>
      ${liste.map((f) => `<tr><td class="n">${f.numero}</td><td class="nm">${echapper(f.nom)}</td><td>${libelleSections(f.sections)}</td>`
        + `<td>${echapper(f.type === "heures" ? f.matiere : f.classe)}</td></tr>`).join("")}</tbody></table>` : "<div></div>");
  return pages.map((liste) => `<section class="page bp somm-page">
    ${cadreGuilloche({ ...CADRE, microTexte: echapper(`${schoolInfo.nom || ""} · ${k("summary")} · ${annee}`.toUpperCase()) })}
    <div class="corps">
      <div class="titre"><i></i><h1>${k("summary")}</h1><i></i></div>
      <div class="numero">${k("yearLine", { annee: echapper(annee) })}</div>
      <div class="somm-cols">${colonne(liste.slice(0, PAR_COLONNE))}${colonne(liste.slice(PAR_COLONNE))}</div>
    </div>
  </section>`).join("");
}

const css = (c1) => `${printResetFor("size:A4 landscape;margin:0")}
  body{margin:0;padding:0;background:#fff}
  @media screen{body{background:#e5e7eb;padding:10px 0}.page.bp{margin:0 auto 10px;box-shadow:0 1px 6px rgba(0,0,0,.18)}}
  .page.bp{--c1:${c1};width:297mm;min-height:209.5mm;box-sizing:border-box;position:relative;display:flex;flex-direction:column;
           background:#fff;font-family:${SERIF};color:#1d1d1f;font-variant-numeric:lining-nums;break-after:page;page-break-after:always}
  .page.bp:last-child{break-after:auto;page-break-after:auto}
  .bp .cadre{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
  .bp .fili{position:absolute;left:calc(50% - 52mm);top:calc(56% - 52mm);width:104mm;height:104mm;display:flex;
            align-items:center;justify-content:center;z-index:0;pointer-events:none}
  .bp .fili svg{position:absolute;inset:0;width:100%;height:100%}
  .bp .fili img{width:58mm;height:58mm;object-fit:contain;opacity:.05}
  .bp .corps{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;padding:10.5mm 13mm 9.5mm}
  .bp .ajustable{flex:1;display:flex;flex-direction:column}

  .bp .tete{display:grid;grid-template-columns:1fr 26mm 1fr;align-items:center;gap:4mm}
  .bp .etat{text-align:center;font-size:6.9px;line-height:1.4;color:#3d3d3d}
  .bp .etat .rep{font-size:8.4px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#1d1d1f}
  .bp .etat .dev{font-size:7.6px;font-style:italic;margin:.2mm 0 .5mm}
  .bp .etat .tut{margin-top:.5mm;letter-spacing:.06em;color:#555}
  .bp .embleme{position:relative;width:26mm;height:23mm;display:flex;align-items:center;justify-content:center;margin:0 auto}
  .bp .embleme .laurier{position:absolute;left:1mm;top:-.5mm;width:24mm;height:24mm}
  .bp .embleme img{position:relative;width:14mm;height:14mm;object-fit:contain;margin-top:-1mm}
  .bp .mono{position:relative;width:13.5mm;height:13.5mm;margin-top:-1mm;border-radius:50%;border:.5mm double var(--c1);display:flex;
            align-items:center;justify-content:center;font-size:13px;font-weight:700;letter-spacing:.06em;color:var(--c1)}
  .bp .ecole{text-align:center}
  .bp .ecole .nom{font-size:17px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--c1);line-height:1.15}
  .bp .ecole .coord{font-size:7.2px;color:#5d5d5d;margin-top:.6mm;letter-spacing:.03em}

  .bp .titre{display:flex;align-items:center;gap:5mm;margin:1.6mm 4mm 0}
  .bp .titre i{flex:1;height:1.2mm;border-top:.35mm solid ${OR};border-bottom:.2mm solid ${OR}}
  .bp .titre h1{margin:0;font-size:18px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:var(--c1);
                white-space:nowrap;padding-inline-start:.24em}
  .bp .numero{text-align:center;font-size:7.8px;letter-spacing:.2em;text-transform:uppercase;color:${OR_FONCE};margin-top:.9mm}

  .bp .cartes{display:grid;grid-template-columns:1fr 1.7fr;gap:4mm;margin-top:2.2mm}
  .bp .carte.fixe .champs{grid-template-columns:repeat(3,1fr)}
  .bp .ligne.c2{grid-column:span 2}
  .bp .carte{position:relative;padding:1.6mm 4mm 2mm;border:.3mm solid ${c1}33;border-inline-start:1mm solid var(--c1);
             background:${c1}0a;border-radius:1mm}
  .bp .carte.fixe{border-inline-start-color:${OR}}
  .bp .carte-t{font-size:6.8px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${OR_FONCE};margin-bottom:.8mm}
  .bp .champs{display:grid;grid-template-columns:1fr 1fr;gap:1.1mm 6mm;font-size:9px}
  .bp .ligne{display:flex;align-items:baseline;gap:1.4mm;white-space:nowrap;min-width:0}
  .bp .ligne.large{grid-column:1/-1}
  .bp .ligne span{color:#5f5f5f;font-size:8.4px;white-space:nowrap}
  .bp .ligne:after{content:"";order:1;flex:1;min-width:6mm;border-bottom:.25mm dotted #a7a7a7;transform:translateY(-.6mm)}
  .bp .ligne b{order:2;font-size:10px;color:#1d1d1f;overflow:hidden;text-overflow:ellipsis}
  .bp .ligne.nomel b{font-size:13px;letter-spacing:.05em;color:var(--c1)}
  .bp .ligne.longue{white-space:normal}
  .bp .ligne.longue b{font-size:8.8px;text-align:end}

  .bp table.paie{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:2.4mm;background:#fff;
                 border:.45mm solid var(--c1)}
  .bp .paie th,.bp .paie td{border:.2mm solid #8a8f98}
  .bp .paie thead th{font-family:Arial,Helvetica,sans-serif;text-transform:uppercase;line-height:1.15}
  .bp .paie tr.groupes th{background:var(--c1);color:#fff;font-size:6.9px;font-weight:700;letter-spacing:.16em;padding:1mm .6mm;
                          border-color:var(--c1)}
  .bp .paie tr.groupes th.coin{font-size:7.4px}
  .bp .paie tr.cols th{background:${c1}14;color:#1d1d1f;font-size:6.4px;font-weight:700;letter-spacing:.03em;padding:.9mm .5mm;height:7mm}
  .bp .paie tr.cols th i{display:block;font-style:normal;font-weight:400;color:#555;margin-top:.2mm;letter-spacing:0}
  .bp .paie tr.cols th.net{background:${OR}38}
  .bp .paie tbody tr{height:var(--rang,9.6mm)}
  .bp .paie tbody tr:nth-child(even) td{background:${c1}06}
  .bp .paie th.mois{font-size:10px;font-weight:700;text-align:start;padding:0 1.6mm;color:var(--c1);letter-spacing:.04em;
                    font-variant:small-caps;background:${c1}0d}
  .bp .paie th.mois small{display:block;font:400 6.4px Arial,Helvetica,sans-serif;color:#7a7a7a;letter-spacing:.1em;font-variant:normal}
  .bp .paie td.fort,.bp .paie tbody tr:nth-child(even) td.fort{background:${c1}10}
  .bp .paie td.net,.bp .paie tbody tr:nth-child(even) td.net{background:${OR}1a;border-inline-start:.4mm solid ${OR};border-inline-end:.4mm solid ${OR}}
  .bp .paie td .pre{display:block;text-align:center;font-size:9.4px;font-weight:700;color:#2c2c2c;letter-spacing:.02em}
  .bp .paie tr.total{height:7mm}
  .bp .paie tr.total th{font:700 6.9px Arial,Helvetica,sans-serif;letter-spacing:.14em;text-transform:uppercase;text-align:start;
                        padding:0 1.6mm;color:#fff;background:var(--c1)}
  .bp .paie tr.total td{background:${c1}14;border-top:.45mm solid var(--c1)}
  .bp .paie tr.total td.net{background:${OR}38}
  .bp .paie tr.total td.neutre{background:repeating-linear-gradient(135deg,#fff 0 1.2mm,#eef0f3 1.2mm 1.6mm)}

  .bp .cloture{margin-top:auto;padding-top:2mm}
  .bp .arrete{display:flex;align-items:baseline;gap:2mm;font-size:9.6px;font-style:italic;color:#333}
  .bp .arrete em{flex:1;border-bottom:.25mm dotted #8f8f8f}
  .bp .note{font:6.8px/1.35 Arial,Helvetica,sans-serif;color:#6b6b6b;margin-top:.8mm}
  .bp .sigs{display:grid;grid-template-columns:repeat(3,1fr);gap:9mm;margin-top:1.4mm}
  .bp .sig{text-align:center}
  .bp .sig b{display:block;font-size:7.4px;letter-spacing:.14em;text-transform:uppercase;color:var(--c1)}
  .bp .sig .nom{display:block;font-size:9.4px;font-weight:700;margin-top:.3mm;min-height:3.4mm}
  .bp .sig .trace{height:8.5mm}
  .bp .sig small{display:block;border-top:.25mm solid #8f8f8f;padding-top:.6mm;font-size:6.9px;font-style:italic;color:#777}

  .bp.couv .corps{padding:14mm 20mm 11mm;align-items:center}
  .bp .couv-etat{font-size:8px}
  .bp .couv-centre{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;width:100%}
  .bp .embleme.grand{width:44mm;height:40mm}
  .bp .embleme.grand .laurier{left:2mm;top:-.5mm;width:40mm;height:40mm}
  .bp .embleme.grand img{width:24mm;height:24mm;margin-top:-1.5mm}
  .bp .embleme.grand .mono{width:23mm;height:23mm;font-size:22px;margin-top:-1.5mm}
  .bp .couv-ecole{font-size:22px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--c1);margin-top:2mm}
  .bp.couv .titre{width:100%;margin-top:6mm}
  .bp.couv .titre h1{font-size:27px}
  .bp .couv-sous{font-size:15px;font-style:italic;color:#333;margin-top:3mm;letter-spacing:.06em}
  .bp .couv-annee{font-size:11px;letter-spacing:.3em;text-transform:uppercase;color:${OR_FONCE};margin-top:4mm}
  .bp .couv-periode{font-size:10px;color:#555;margin-top:1.4mm;letter-spacing:.08em}
  .bp .couv-compte{font:9px/1.5 Arial,Helvetica,sans-serif;color:#555;margin-top:6mm;padding:1.6mm 6mm;border-top:.25mm solid ${OR};border-bottom:.25mm solid ${OR}}
  .bp .couv-pied{width:100%}

  .bp.somm-page .corps{padding:13mm 16mm 11mm}
  .bp .somm-cols{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-top:5mm}
  .bp table.somm{width:100%;border-collapse:collapse;font-size:9px}
  .bp .somm th{font:700 6.8px Arial,Helvetica,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#fff;background:var(--c1);
               padding:1.4mm 1.6mm;text-align:start}
  .bp .somm td{padding:1.25mm 1.6mm;border-bottom:.2mm solid #d7dadf}
  .bp .somm tbody tr:nth-child(even) td{background:${c1}08}
  .bp .somm .n{width:11mm;text-align:center;color:${OR_FONCE};font-weight:700}
  .bp .somm th.n{color:#fff}
  .bp .somm .nm{font-weight:700;color:#1d1d1f}
`;

// Document complet : couverture et sommaire (optionnels), puis un feuillet
// par enseignant. `mois` : les mois payés de l'année scolaire, dans l'ordre.
// `totalFeuillets` : taille du registre complet, quand on n'en imprime qu'une
// partie (un feuillet réimprimé garde « n° 7 / 24 »).
export function htmlBulletinsPaie({ fiches = [], schoolInfo = {}, annee = "", mois = [], couverture = true, totalFeuillets = 0 } = {}) {
  const c1 = schoolInfo.couleur1 || "#0A1628";
  const ecole = identiteEcole(schoolInfo);
  const ctx = { ecole, schoolInfo, annee, mois, total: Math.max(totalFeuillets, fiches.length) };
  // Hauteur d'une ligne de mois : 9 mois tiennent à l'aise, une année plus
  // longue resserre les lignes plutôt que de déborder.
  const rang = `${Math.min(9.6, Math.max(6, Math.floor(830 / Math.max(1, mois.length)) / 10))}mm`;
  const pages = [
    couverture && fiches.length > 1 ? pageCouverture(fiches, ctx) + pagesSommaire(fiches, ctx) : "",
    ...fiches.map((f) => feuillet(f, ctx)),
  ].join("");
  const titre = fiches.length === 1 ? `${k("title")} — ${fiches[0].nom}` : k("docTitle", { annee });
  return `<!DOCTYPE html><html lang="${printLang()}" dir="${printDir()}"><head><meta charset="utf-8"/>
  <title>${echapper(titre)}</title>
  <style>${css(c1)} .bp .paie tbody{--rang:${rang}}</style></head><body>
  ${pages}
  <script>${ajusterPagesScript(".page.bp", 210)}${PRINT_TRIGGER}</script></body></html>`;
}

// Ouvre la fenêtre d'impression. Renvoie false si le navigateur l'a bloquée.
export function imprimerBulletinsPaie(options) {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(htmlBulletinsPaie(options));
  w.document.close();
  return true;
}
