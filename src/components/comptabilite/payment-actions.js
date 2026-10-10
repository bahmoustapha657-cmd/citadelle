// ══════════════════════════════════════════════════════════════
//  Comptabilité — actions de paiement (mensualités, frais annexes, bons)
// ══════════════════════════════════════════════════════════════
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.
// Ces actions sont UI-coupled (confirm/toast/push) mais reçoivent
// leurs dépendances par injection pour rester découplées du parent.

import { fmt, initMens } from "../../constants";
import { sumBonsForSalary } from "../../salary-utils";
import { notifierParents } from "../../backend/notify-supabase";
import { champsRetraitAcompte } from "../../paiements-scolarite";
import { champsBasculeFrais } from "./frais-bascule";
import { MOTIFS_ANNULATION, ecritureAnnulation, ecritureEncaissement } from "./paiements-journal";
import { demanderMotifAnnulation } from "./motif-annulation";
import { clePosteFrais, clePosteMois, conflitFiche, messageConflit } from "./fiche-a-jour";

// Libellé de l'historique des actions pour un retrait motivé.
const actionRetrait = ({ motif }) => (motif === "remboursement" ? "Paiement remboursé" : "Erreur de saisie corrigée");
const detailRetrait = (texte, { motif, explication }) =>
  `${texte} — ${MOTIFS_ANNULATION[motif] || motif} : « ${explication} »`;

// Année archivée affichée (canCreate faux sans lecture seule) : rien ne
// s'encaisse. L'écriture partirait sur la fiche de l'année EN COURS, avec
// l'état d'une autre année.
const MSG_ARCHIVE = "Année archivée : consultation seule, aucun encaissement possible.";

// Écrit une ligne au journal des encaissements. Si le journal refuse
// l'écriture (droits, réseau), l'encaissement lui-même reste acquis — perdre
// le paiement parce que sa trace a échoué serait pire que l'inverse. La ligne
// n'est pas perdue pour autant : `ajPaiement` (use-journal-en-attente) la
// garde sur l'appareil et la renverra — `{ enAttente: true }`.
async function journaliser(ajPaiement, ecriture, toast) {
  if (typeof ajPaiement !== "function") return;
  try {
    const resultat = await ajPaiement(ecriture);
    if (resultat?.enAttente) {
      console.error("journal des paiements:", resultat.erreur);
      toast?.("Paiement enregistré. Sa ligne de journal de caisse n'a pas pu s'écrire : elle est gardée sur cet appareil et sera inscrite automatiquement.", "warning");
    }
  } catch (e) {
    console.error("journal des paiements:", e);
    toast?.("Paiement enregistré, mais non inscrit au journal de caisse.", "warning");
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
    toast?.(`Un encaissement est déjà en cours pour ${nomEleve||"cet élève"} : patientez un instant.`,"warning");
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
  if(!canCreate){ toast(MSG_ARCHIVE,"warning"); return; }
  if(valeurActuelle && !canEdit){
    toast(`Le retrait de ${label.toLowerCase()} nécessite l'autorisation de l'administrateur (verrou activé).`,"warning");
    return;
  }
  // Sans la fiche, on réécrirait les cartes de frais à partir de rien et les
  // autres frais déjà payés disparaîtraient.
  const fiche = opts.eleve || eleve;
  if(!fiche){ toast("Fiche élève introuvable : rechargez la page puis réessayez.","error"); return; }
  const { champs, montantJournal, acompte } = champsBasculeFrais({
    eleve: fiche, poste, valeurActuelle, montant, date: new Date().toLocaleDateString("fr-FR"),
  });
  // Dispense totale d'un frais : il n'y a rien à encaisser. L'inscription, elle,
  // se valide quand même : c'est ce qui marque l'élève réinscrit.
  const estInscription = poste === "inscription";
  if(!valeurActuelle && montantJournal<=0 && !estInscription){ toast(`Rien à encaisser pour ${label.toLowerCase()}.`,"info"); return; }
  const montantLabel = montantJournal>0 ? ` (${fmt(montantJournal)})` : "";
  const message = valeurActuelle
    ? `Retirer ${label.toLowerCase()}${montantLabel} pour ${nomEleve} ?`
    : acompte>0
      ? `Solder ${label.toLowerCase()} pour ${nomEleve} : reste ${fmt(montantJournal)} (acompte de ${fmt(acompte)} déjà versé) ?`
      : montantJournal>0
        ? `Marquer ${label.toLowerCase()}${montantLabel} comme payé pour ${nomEleve} ?`
        : `Valider ${label.toLowerCase()} de ${nomEleve} sans encaissement (dispense) ?`;
  // Retrait d'un frais réellement encaissé : motif + explication, au lieu
  // d'une simple confirmation (cf. motif-annulation).
  const retraitMotive = valeurActuelle && montantJournal>0;
  let retrait = null;
  if(retraitMotive){
    retrait = await demanderMotifAnnulation({
      titre: `Retirer ${label.toLowerCase()}`,
      message: `${nomEleve} · ${label} · ${fmt(montantJournal)}`,
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
  if(!canCreate){ toast(MSG_ARCHIVE,"warning"); return; }
  const mens={...(mensActuels||initMens())};
  const estPaye=mens[mois]==="Payé";
  if(estPaye && !canEdit){
    toast("Le décochage nécessite l'autorisation de l'administrateur (verrou activé).","warning");
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
      titre: `Décocher ${mois}`,
      message: `${nomEleve||"Élève"} · ${mois}${montantRetire>0?` · ${fmt(montantRetire)}`:""}`,
    });
    if(!retrait) return;
  } else {
    const msg = acompte>0 && reste!==null
      ? `Solder ${mois} pour ${nomEleve||""} : reste ${fmt(reste)} (acompte de ${fmt(acompte)} déjà versé) ?`
      : `Marquer ${mois} comme payé pour ${nomEleve||""} ?`;
    if(!confirm(msg)) return;
  }
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
  if(retrait) logAction?.(actionRetrait(retrait), detailRetrait(`${nomEleve||"Élève"} · ${mois} · ${fmt(montantRetire)}`, retrait));
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
  if(!estPaye){
    envoyerPush(["parent"],"✅ Paiement enregistré",`Mensualité ${mois} de ${nomEleve||"votre enfant"} confirmée.`,"/paiements",{ eleveId: _id });
  } else if(retrait.motif === "erreur_saisie"){
    // Le parent a pu recevoir « Paiement enregistré » : on rectifie, sans
    // l'alarmer d'un « rappel de paiement ».
    envoyerPush(["parent"],"ℹ️ Rectification",`Le paiement de la mensualité ${mois} de ${nomEleve||"votre enfant"} avait été enregistré par erreur ; il a été corrigé.`,"/paiements",{ eleveId: _id });
  } else {
    envoyerPush(["parent"],"⚠️ Rappel de paiement",`La mensualité ${mois} de ${nomEleve||"votre enfant"} est marquée impayée.`,"/paiements",{ eleveId: _id });
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
  if(!canCreate){ toast(MSG_ARCHIVE,"warning"); return false; }
  if(!plan?.ok || !plan.lignes?.length) return false;
  // `eleve` : la fiche sur laquelle la fenêtre a calculé le plan.
  const ecrit = await surFicheAJour(_id, { affichee: eleve, nomEleve, lireFiche, toast }, () => modEleves(_id, plan.champs));
  if(!ecrit) return false;
  const detail = plan.lignes.map((l) => `${l.libelle} ${fmt(l.montant)}`).join(", ");
  logAction?.("Versement encaissé", `${nomEleve} · ${fmt(plan.total)} — ${detail}`);
  for (const ligne of plan.lignes) {
    await journaliser(ajPaiement, ecritureEncaissement({
      annee, eleve: eleve || { _id, nom: nomEleve }, type: ligne.type, mois: ligne.mois,
      libelle: ligne.libelle, montant: ligne.montant, auteur,
    }), toast);
  }
  if(plan.moisSoldes?.length){
    const liste = plan.moisSoldes.join(", ");
    envoyerPush?.(["parent"],"✅ Paiement enregistré",`Mensualité(s) ${liste} de ${nomEleve||"votre enfant"} confirmée(s).`,"/paiements",{ eleveId: _id });
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
    toast("Retirer un acompte nécessite l'autorisation de l'administrateur (verrou activé).","warning");
    return false;
  }
  const { champs, montant } = champsRetraitAcompte(eleve || {}, { type, cle });
  if(!(montant>0)) return false;
  const retrait = await demanderMotifAnnulation({
    titre: "Annuler un acompte",
    message: `${nomEleve} · ${label} · acompte de ${fmt(montant)}`,
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
  if(moisSel==="__TOUS__"){toast("Sélectionnez un mois précis pour appliquer les bons.","warning");return;}
  if(!bonsMois.length){toast("Aucun bon enregistré pour ce mois.","warning");return;}
  if(!confirm(`Appliquer les bons du mois de ${moisSel} aux salaires ?\n\nLe champ "Bon" de chaque enseignant sera mis à jour.`)) return;
  let nb=0;
  for(const sal of salairesMois){
    const total=sumBonsForSalary(sal,bonsMois);
    if(total!==Number(sal.bon||0)){await modS({...sal,bon:total});nb++;}
  }
  toast(`${nb} salaire(s) mis à jour.`,"success");
}
