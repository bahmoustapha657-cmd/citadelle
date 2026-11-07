// ══════════════════════════════════════════════════════════════
//  Comptabilité — actions de paiement (mensualités, frais annexes, bons)
// ══════════════════════════════════════════════════════════════
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.
// Ces actions sont UI-coupled (confirm/toast/push) mais reçoivent
// leurs dépendances par injection pour rester découplées du parent.

import i18n from "../../i18n";
import { fmt, initMens } from "../../constants";
import { sumBonsForSalary } from "../../salary-utils";
import { notifierParents } from "../../backend/notify-supabase";
import { champsRetraitAcompte } from "../../paiements-scolarite";
import { champsBasculeFrais } from "./frais-bascule";
import { MOTIFS_ANNULATION, ecritureAnnulation, ecritureEncaissement } from "./paiements-journal";
import { demanderMotifAnnulation } from "./motif-annulation";
import { clePosteFrais, clePosteMois, conflitFiche, messageConflit } from "./fiche-a-jour";

// Le journal des actions (historique) est une donnée partagée : ses libellés
// restent en français. Seuls les messages, confirmations et notifications
// suivent la langue de l'utilisateur.
// Libellé de l'historique des actions pour un retrait motivé.
// i18n-ignore
const actionRetrait = ({ motif }) => (motif === "remboursement" ? "Paiement remboursé" : "Erreur de saisie corrigée");
const detailRetrait = (texte, { motif, explication }) =>
  `${texte} — ${MOTIFS_ANNULATION[motif] || motif} : « ${explication} »`;

// Année archivée affichée (canCreate faux sans lecture seule) : rien ne
// s'encaisse. L'écriture partirait sur la fiche de l'année EN COURS, avec
// l'état d'une autre année.
const msgArchive = () => i18n.t("accounting.pay.archived");
// Libellé affiché d'un mois (les mois restent en français dans les données).
const nomMois = (mois) => i18n.t(`months.${mois}`, mois);

// Écrit une ligne au journal des encaissements. BEST-EFFORT : si le journal
// refuse l'écriture (droits, réseau), l'encaissement lui-même reste acquis —
// perdre le paiement parce que sa trace a échoué serait pire que l'inverse.
// L'utilisateur est averti pour pouvoir régulariser.
async function journaliser(ajPaiement, ecriture, toast) {
  if (typeof ajPaiement !== "function") return;
  try {
    await ajPaiement(ecriture);
  } catch (e) {
    console.error("journal des paiements:", e);
    toast?.(i18n.t("accounting.pay.notJournaled"), "warning");
  }
}

// Un seul encaissement à la fois par élève : deux clics rapprochés partaient
// chacun de la même fiche, et le second effaçait le premier.
const elevesEnCours = new Set();

// Encadre l'écriture d'un paiement : verrou par élève, puis relecture de la
// fiche (cf. fiche-a-jour). `ecrire` ne s'exécute que si la fiche affichée est
// toujours à jour ; renvoie false sinon. `lireFiche(_id)` → versions relues
// (absent : pas de relecture, ex. build Firebase).
async function surFicheAJour(_id, { affichee, nomEleve, lireFiche, toast, retrait = null }, ecrire) {
  if(elevesEnCours.has(_id)){
    toast?.(i18n.t("accounting.pay.inProgress", { name: nomEleve || i18n.t("accounting.pay.thisStudent") }),"warning");
    return false;
  }
  elevesEnCours.add(_id);
  try {
    if(typeof lireFiche === "function" && affichee){
      let versions = [];
      try { versions = await lireFiche(_id); } catch (e) { console.warn("relecture de la fiche:", e); }
      const ignores = conflitFiche(affichee, versions, { retrait });
      if(ignores){ toast?.(messageConflit(nomEleve, ignores),"error"); return false; }
    }
    await ecrire();
    return true;
  } finally {
    elevesEnCours.delete(_id);
  }
}

// Marque un frais ponctuel comme payé/impayé sur un élève. `opts.poste` vaut
// "inscription" ou l'id d'un frais du catalogue (autre, revision, uniforme…) ;
// `opts.eleve` est la fiche affichée, dont on repart pour les cartes de frais
// (cf. champsBasculeFrais, qui fige aussi le montant).
// Bloqué si readOnly ou en année archivée. Le retrait d'un frais déjà payé
// exige canEdit (verrou admin), pour éviter qu'un comptable annule un
// encaissement sans validation.
export async function toggleFraisAnnexe(_id, opts, {
  readOnly, canCreate = false, canEdit, toast, modEleves, logAction,
  ajPaiement = null, annee = "", auteur = "", eleve = null, lireFiche = null,
}) {
  // `confirmer:false` : la question a déjà été posée UNE fois pour tout un
  // lot (encaissement groupé des inscriptions). Sans cela, réinscrire une
  // classe de 50 élèves ouvrirait 50 fenêtres de confirmation.
  const { poste, valeurActuelle=false, label, montant=0, nomEleve="", confirmer=true } = opts;
  if(readOnly) return;
  if(!canCreate){ toast(msgArchive(),"warning"); return; }
  // Libellé affiché : l'inscription suit la langue, un frais garde son nom.
  const labelAff = poste === "inscription"
    ? i18n.t(label === "Réinscription" ? "accounting.mens.reEnrolment" : "accounting.mens.enrolment")
    : label;
  const labelMin = labelAff.toLowerCase();
  if(valeurActuelle && !canEdit){
    toast(i18n.t("accounting.pay.removeNeedsAdmin", { label: labelMin }),"warning");
    return;
  }
  // Sans la fiche, on réécrirait les cartes de frais à partir de rien et les
  // autres frais déjà payés disparaîtraient.
  const fiche = opts.eleve || eleve;
  if(!fiche){ toast(i18n.t("accounting.pay.recordNotFound"),"error"); return; }
  const { champs, montantJournal, acompte } = champsBasculeFrais({
    eleve: fiche, poste, valeurActuelle, montant, date: new Date().toLocaleDateString("fr-FR"),
  });
  // Dispense totale d'un frais : il n'y a rien à encaisser. L'inscription, elle,
  // se valide quand même : c'est ce qui marque l'élève réinscrit.
  const estInscription = poste === "inscription";
  if(!valeurActuelle && montantJournal<=0 && !estInscription){ toast(i18n.t("accounting.pay.nothingFor", { label: labelMin }),"info"); return; }
  const montantLabel = montantJournal>0 ? ` (${fmt(montantJournal)})` : "";
  const message = valeurActuelle
    ? i18n.t("accounting.pay.confirmRemove", { label: labelMin, amount: montantLabel, name: nomEleve })
    : acompte>0
      ? i18n.t("accounting.pay.confirmSettle", { label: labelMin, name: nomEleve, rest: fmt(montantJournal), deposit: fmt(acompte) })
      : montantJournal>0
        ? i18n.t("accounting.pay.confirmMark", { label: labelMin, amount: montantLabel, name: nomEleve })
        : i18n.t("accounting.pay.confirmExempt", { label: labelMin, name: nomEleve });
  // Retrait d'un frais réellement encaissé : motif + explication, au lieu
  // d'une simple confirmation (cf. motif-annulation).
  const retraitMotive = valeurActuelle && montantJournal>0;
  let retrait = null;
  if(retraitMotive){
    retrait = await demanderMotifAnnulation({
      titre: i18n.t("accounting.pay.removeTitle", { label: labelMin }),
      message: `${nomEleve} · ${labelAff} · ${fmt(montantJournal)}`,
    });
    if(!retrait) return;
  } else if(confirmer && !confirm(message)) return;
  const ecrit = await surFicheAJour(_id, {
    affichee: fiche, nomEleve, lireFiche, toast, retrait: valeurActuelle ? clePosteFrais(poste) : null,
  }, () => modEleves(_id, champs));
  if(!ecrit) return;
  // Journal d'audit : chaque encaissement/retrait de frais laisse une trace.
  const detailFrais = `${nomEleve} · ${label}${montantJournal>0?` · ${fmt(montantJournal)}`:""}`;
  if(retrait) logAction?.(actionRetrait(retrait), detailRetrait(detailFrais, retrait));
  // i18n-ignore
  else logAction?.(valeurActuelle ? "Frais annexe retiré" : "Frais annexe encaissé", detailFrais);
  // Grand livre : l'inscription et les frais annexes sont des encaissements
  // au même titre que les mensualités. `mois` porte l'id du frais. Rien
  // d'encaissé (dispense) : aucune ligne.
  if(montantJournal<=0) return;
  const params = {
    annee,
    eleve: eleve || fiche || { _id, nom: nomEleve },
    type: estInscription ? "inscription" : "frais",
    mois: poste,
    libelle: !valeurActuelle && acompte>0 ? `${label} (solde)` : label,
    montant: montantJournal,
    auteur,
  };
  await journaliser(ajPaiement, valeurActuelle ? ecritureAnnulation({ ...params, ...retrait }) : ecritureEncaissement(params), toast);
}

// Toggle de mensualité d'un élève (Payé/Impayé) avec push parent.
// Le décochage exige le verrou admin (canEdit) ; le push de confirmation
// est envoyé au parent dans les 2 sens (payé → confirmation, impayé → rappel).
// Le MONTANT dû (après dispense) est figé au moment du paiement
// (mensMontants[mois]) : un changement de tarif en cours d'année ne
// réécrit plus rétroactivement les totaux perçus. Un mois entamé par un
// acompte (mensAcomptes) se solde : seul le reste s'encaisse.
export async function toggleMens(_id, mois, mensActuels, mensDatesActuels, nomEleve, {
  readOnly, canCreate = false, canEdit, toast, modEleves, envoyerPush, logAction, montantMois = null, mensMontantsActuels = null,
  mensAcomptesActuels = null, ajPaiement = null, annee = "", auteur = "", eleve = null, lireFiche = null,
}) {
  if(readOnly) return;
  if(!canCreate){ toast(msgArchive(),"warning"); return; }
  const mens={...(mensActuels||initMens())};
  const estPaye=mens[mois]==="Payé";
  if(estPaye && !canEdit){
    toast(i18n.t("accounting.pay.uncheckNeedsAdmin"),"warning");
    return;
  }
  const du = Number.isFinite(Number(montantMois)) ? Number(montantMois) : null;
  const acompte = Math.max(0, Number(mensAcomptesActuels?.[mois]) || 0);
  const reste = du===null ? null : Math.max(0, du - acompte);
  // Décocher : motif (erreur de saisie / remboursement) + explication,
  // conservés au journal. Cocher : simple confirmation.
  const montantRetire = estPaye ? (mensMontantsActuels?.[mois] ?? du ?? 0) : 0;
  let retrait = null;
  if(estPaye){
    retrait = await demanderMotifAnnulation({
      titre: i18n.t("accounting.pay.uncheckTitle", { month: nomMois(mois) }),
      message: `${nomEleve||i18n.t("accounting.pay.student")} · ${nomMois(mois)}${montantRetire>0?` · ${fmt(montantRetire)}`:""}`,
    });
    if(!retrait) return;
  } else {
    const msg = acompte>0 && reste!==null
      ? i18n.t("accounting.pay.confirmSettle", { label: nomMois(mois), name: nomEleve||"", rest: fmt(reste), deposit: fmt(acompte) })
      : i18n.t("accounting.pay.confirmMark", { label: nomMois(mois), amount: "", name: nomEleve||"" });
    if(!confirm(msg)) return;
  }
  // i18n-ignore
  mens[mois]=estPaye?"Impayé":"Payé";
  const mensDates={...(mensDatesActuels||{})};
  const mensMontants={...(mensMontantsActuels||{})};
  const mensAcomptes={...(mensAcomptesActuels||{})};
  if(!estPaye){
    mensDates[mois]=new Date().toLocaleDateString("fr-FR");
    // Figé : le total versé sur le mois, acompte compris.
    if(du!==null) mensMontants[mois]=Math.max(du, acompte);
  } else {
    delete mensDates[mois];
    delete mensMontants[mois];
  }
  delete mensAcomptes[mois];
  // Fiche telle qu'affichée au moment du clic : c'est sur elle que l'on a
  // calculé ce qui s'écrit.
  const affichee = { ...(eleve || {}), mens: mensActuels || initMens(), mensAcomptes: mensAcomptesActuels || {} };
  const ecrit = await surFicheAJour(_id, {
    affichee, nomEleve, lireFiche, toast, retrait: estPaye ? clePosteMois(mois) : null,
  }, () => modEleves(_id,{mens,mensDates,mensMontants,mensAcomptes}));
  if(!ecrit) return;
  // Journal d'audit : chaque encaissement ET chaque décochage laisse une
  // trace (élève, mois, montant) — cœur de la promesse de traçabilité.
  const montantEncaisse = reste ?? 0;
  const montantJournal = !estPaye && montantEncaisse > 0 ? ` · ${fmt(montantEncaisse)}` : "";
  // i18n-ignore
  if(retrait) logAction?.(actionRetrait(retrait), detailRetrait(`${nomEleve||"Élève"} · ${mois} · ${fmt(montantRetire)}`, retrait));
  // i18n-ignore
  else logAction?.("Mensualité encaissée", `${nomEleve||"Élève"} · ${mois}${montantJournal}`);
  // Grand livre : le décochage n'efface pas la ligne d'encaissement, il ajoute
  // une contre-passation. C'est ce qui permet à la caisse de rester juste et à
  // l'historique de survivre à la clôture d'année. Solder un mois entamé
  // n'encaisse que le reste : l'acompte a déjà sa ligne.
  const params = {
    annee,
    eleve: eleve || { _id, nom: nomEleve },
    type: "mensualite",
    mois,
    libelle: !estPaye && acompte>0 ? `${mois} (solde)` : mois,
    montant: estPaye ? montantRetire : montantEncaisse,
    auteur,
  };
  await journaliser(ajPaiement, estPaye ? ecritureAnnulation({ ...params, ...retrait }) : ecritureEncaissement(params), toast);
  // Push aux seuls parents de CET élève (eleveId), pas à toutes les familles.
  const pourPush = { month: nomMois(mois), name: nomEleve || i18n.t("accounting.pay.yourChild") };
  if(!estPaye){
    envoyerPush(["parent"],`✅ ${i18n.t("accounting.pay.pushPaidTitle")}`,i18n.t("accounting.pay.pushPaidBody", pourPush),"/paiements",{ eleveId: _id });
  } else if(retrait.motif === "erreur_saisie"){
    // Le parent a pu recevoir « Paiement enregistré » : on rectifie, sans
    // l'alarmer d'un « rappel de paiement ».
    envoyerPush(["parent"],`ℹ️ ${i18n.t("accounting.pay.pushFixTitle")}`,i18n.t("accounting.pay.pushFixBody", pourPush),"/paiements",{ eleveId: _id });
  } else {
    envoyerPush(["parent"],`⚠️ ${i18n.t("accounting.pay.pushReminderTitle")}`,i18n.t("accounting.pay.pushReminderBody", pourPush),"/paiements",{ eleveId: _id });
  }
  // Notification SMS/WhatsApp au tuteur (best-effort, inactive si non configurée).
  // Seul l'encaissement notifie ; le décochage (impayé) reste un push interne.
  if(!estPaye){
    notifierParents("paiement", { eleveId: _id, data: { nomEleve, mois, paye: true } });
  }
}

// Encaisse un versement préparé par planVersement (paiements-scolarite) :
// montant libre réparti sur les mois, tranche, ou acompte sur un frais. Une
// ligne au journal par mois ou frais touché, une trace d'audit, et le parent
// est prévenu quand des mois sont soldés. Renvoie true si c'est enregistré.
export async function encaisserVersement(_id, { plan, nomEleve = "", eleve = null }, {
  readOnly, canCreate = false, toast, modEleves, envoyerPush, logAction,
  ajPaiement = null, annee = "", auteur = "", lireFiche = null,
}) {
  if(readOnly) return false;
  if(!canCreate){ toast(msgArchive(),"warning"); return false; }
  if(!plan?.ok || !plan.lignes?.length) return false;
  // `eleve` : la fiche sur laquelle la fenêtre a calculé le plan.
  const ecrit = await surFicheAJour(_id, { affichee: eleve, nomEleve, lireFiche, toast }, () => modEleves(_id, plan.champs));
  if(!ecrit) return false;
  const detail = plan.lignes.map((l) => `${l.libelle} ${fmt(l.montant)}`).join(", ");
  // i18n-ignore
  logAction?.("Versement encaissé", `${nomEleve} · ${fmt(plan.total)} — ${detail}`);
  for (const ligne of plan.lignes) {
    await journaliser(ajPaiement, ecritureEncaissement({
      annee, eleve: eleve || { _id, nom: nomEleve }, type: ligne.type, mois: ligne.mois,
      libelle: ligne.libelle, montant: ligne.montant, auteur,
    }), toast);
  }
  if(plan.moisSoldes?.length){
    const liste = plan.moisSoldes.join(", ");
    envoyerPush?.(["parent"],`✅ ${i18n.t("accounting.pay.pushPaidTitle")}`,i18n.t("accounting.pay.pushPaidManyBody", {
      months: plan.moisSoldes.map(nomMois).join(", "), name: nomEleve || i18n.t("accounting.pay.yourChild"),
    }),"/paiements",{ eleveId: _id });
    notifierParents("paiement", { eleveId: _id, data: { nomEleve, mois: liste, paye: true } });
  }
  return true;
}

// Annule un acompte saisi par erreur (mois, inscription ou frais). Exige le
// verrou admin, comme tout retrait d'encaissement ; le journal garde une
// contre-passation du montant.
export async function retirerAcompte(_id, { type, cle, label, nomEleve = "", eleve = null }, {
  readOnly, canEdit, toast, modEleves, logAction,
  ajPaiement = null, annee = "", auteur = "", lireFiche = null,
}) {
  if(readOnly) return false;
  if(!canEdit){
    toast(i18n.t("accounting.pay.depositNeedsAdmin"),"warning");
    return false;
  }
  const { champs, montant } = champsRetraitAcompte(eleve || {}, { type, cle });
  if(!(montant>0)) return false;
  const retrait = await demanderMotifAnnulation({
    titre: i18n.t("accounting.pay.cancelDepositTitle"),
    message: i18n.t("accounting.pay.depositMessage", {
      name: nomEleve,
      label: type === "inscription" ? i18n.t("accounting.mens.enrolment") : type === "mois" ? nomMois(label) : label,
      amount: fmt(montant),
    }),
  });
  if(!retrait) return false;
  const ecrit = await surFicheAJour(_id, { affichee: eleve, nomEleve, lireFiche, toast }, () => modEleves(_id, champs));
  if(!ecrit) return false;
  logAction?.(actionRetrait(retrait), detailRetrait(`${nomEleve} · ${label} (acompte) · ${fmt(montant)}`, retrait));
  await journaliser(ajPaiement, ecritureAnnulation({
    annee, eleve: eleve || { _id, nom: nomEleve },
    type: type === "mois" ? "mensualite" : type === "inscription" ? "inscription" : "frais",
    mois: type === "inscription" ? "inscription" : cle,
    libelle: `${label} (acompte)`, montant, auteur,
    ...retrait,
  }), toast);
  return true;
}

// Applique le total des bons du mois sur les fiches de paie correspondantes.
// sumBonsForSalary matche par (nom normalisé, mois, section) — le filtre
// section évite qu'un bon Secondaire soit dupliqué sur la fiche Personnel
// du même agent (prof + admin) et que le net se retrouve doublé.
export async function appliquerBons({ moisSel, bonsMois, salairesMois, readOnly, toast, modS }) {
  if(readOnly) return;
  if(moisSel==="__TOUS__"){toast(i18n.t("accounting.pay.bonsPickMonth"),"warning");return;}
  if(!bonsMois.length){toast(i18n.t("accounting.pay.bonsNone"),"warning");return;}
  if(!confirm(i18n.t("accounting.pay.bonsConfirm", { month: nomMois(moisSel), field: i18n.t("accounting.salaryBonus") }))) return;
  let nb=0;
  for(const sal of salairesMois){
    const total=sumBonsForSalary(sal,bonsMois);
    if(total!==Number(sal.bon||0)){await modS({...sal,bon:total});nb++;}
  }
  toast(i18n.t("accounting.pay.bonsDone", { count: nb }),"success");
}
