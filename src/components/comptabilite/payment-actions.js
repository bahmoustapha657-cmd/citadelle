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
import { ecritureAnnulation, ecritureEncaissement } from "./paiements-journal";

// Année archivée affichée (canCreate faux sans lecture seule) : rien ne
// s'encaisse. L'écriture partirait sur la fiche de l'année EN COURS, avec
// l'état d'une autre année.
const MSG_ARCHIVE = "Année archivée : consultation seule, aucun encaissement possible.";

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
    toast?.("Paiement enregistré, mais non inscrit au journal de caisse.", "warning");
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
  ajPaiement = null, annee = "", auteur = "", eleve = null,
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
  if(confirmer && !confirm(message)) return;
  await modEleves(_id, champs);
  // Journal d'audit : chaque encaissement/retrait de frais laisse une trace.
  logAction?.(
    valeurActuelle ? "Frais annexe retiré" : "Frais annexe encaissé",
    `${nomEleve} · ${label}${montantJournal>0?` · ${fmt(montantJournal)}`:""}`,
  );
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
  await journaliser(ajPaiement, valeurActuelle ? ecritureAnnulation(params) : ecritureEncaissement(params), toast);
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
  mensAcomptesActuels = null, ajPaiement = null, annee = "", auteur = "", eleve = null,
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
  const msg = estPaye
    ? `Décocher ${mois} et marquer comme impayé pour ${nomEleve||""} ?`
    : acompte>0 && reste!==null
      ? `Solder ${mois} pour ${nomEleve||""} : reste ${fmt(reste)} (acompte de ${fmt(acompte)} déjà versé) ?`
      : `Marquer ${mois} comme payé pour ${nomEleve||""} ?`;
  if(!confirm(msg)) return;
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
  await modEleves(_id,{mens,mensDates,mensMontants,mensAcomptes});
  // Journal d'audit : chaque encaissement ET chaque décochage laisse une
  // trace (élève, mois, montant) — cœur de la promesse de traçabilité.
  const montantEncaisse = reste ?? 0;
  const montantJournal = !estPaye && montantEncaisse > 0 ? ` · ${fmt(montantEncaisse)}` : "";
  logAction?.(
    estPaye ? "Mensualité décochée (impayé)" : "Mensualité encaissée",
    `${nomEleve||"Élève"} · ${mois}${montantJournal}`,
  );
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
    montant: estPaye ? (mensMontantsActuels?.[mois] ?? du ?? 0) : montantEncaisse,
    auteur,
  };
  await journaliser(ajPaiement, estPaye ? ecritureAnnulation(params) : ecritureEncaissement(params), toast);
  if(!estPaye){
    envoyerPush(["parent"],"✅ Paiement enregistré",`Mensualité ${mois} de ${nomEleve||"votre enfant"} confirmée.`,"/paiements");
  } else {
    envoyerPush(["parent"],"⚠️ Rappel de paiement",`La mensualité ${mois} de ${nomEleve||"votre enfant"} est marquée impayée.`,"/paiements");
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
  ajPaiement = null, annee = "", auteur = "",
}) {
  if(readOnly) return false;
  if(!canCreate){ toast(MSG_ARCHIVE,"warning"); return false; }
  if(!plan?.ok || !plan.lignes?.length) return false;
  await modEleves(_id, plan.champs);
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
    envoyerPush?.(["parent"],"✅ Paiement enregistré",`Mensualité(s) ${liste} de ${nomEleve||"votre enfant"} confirmée(s).`,"/paiements");
    notifierParents("paiement", { eleveId: _id, data: { nomEleve, mois: liste, paye: true } });
  }
  return true;
}

// Annule un acompte saisi par erreur (mois, inscription ou frais). Exige le
// verrou admin, comme tout retrait d'encaissement ; le journal garde une
// contre-passation du montant.
export async function retirerAcompte(_id, { type, cle, label, nomEleve = "", eleve = null }, {
  readOnly, canEdit, toast, modEleves, logAction,
  ajPaiement = null, annee = "", auteur = "",
}) {
  if(readOnly) return false;
  if(!canEdit){
    toast("Retirer un acompte nécessite l'autorisation de l'administrateur (verrou activé).","warning");
    return false;
  }
  const { champs, montant } = champsRetraitAcompte(eleve || {}, { type, cle });
  if(!(montant>0)) return false;
  if(!confirm(`Annuler l'acompte de ${fmt(montant)} (${label}) pour ${nomEleve} ?`)) return false;
  await modEleves(_id, champs);
  logAction?.("Acompte annulé", `${nomEleve} · ${label} · ${fmt(montant)}`);
  await journaliser(ajPaiement, ecritureAnnulation({
    annee, eleve: eleve || { _id, nom: nomEleve },
    type: type === "mois" ? "mensualite" : type === "inscription" ? "inscription" : "frais",
    mois: type === "inscription" ? "inscription" : cle,
    libelle: `${label} (acompte)`, montant, auteur,
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
