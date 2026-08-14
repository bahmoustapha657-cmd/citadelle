// ══════════════════════════════════════════════════════════════
//  Comptabilité — actions de paiement (mensualités, frais annexes, bons)
// ══════════════════════════════════════════════════════════════
// Extrait de Comptabilite.jsx au refactor découpage 2026-05-20.
// Ces actions sont UI-coupled (confirm/toast/push) mais reçoivent
// leurs dépendances par injection pour rester découplées du parent.

import { fmt, initMens } from "../../constants";
import { sumBonsForSalary } from "../../salary-utils";
import { notifierParents } from "../../backend/notify-supabase";
import { ecritureAnnulation, ecritureEncaissement } from "./paiements-journal";

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

// Marque un frais annexe comme payé/impayé sur un élève. Deux formes :
//   • legacy (inscription, « autre ») : drapeaux dédiés payKey/dateKey ;
//   • catalogue (uniforme, cantine…)  : opts.fraisId + fraisPayesActuels →
//     carte eleves.fraisPayes = { id: "date de paiement" }.
// Bloqué si readOnly. Le retrait d'un frais déjà payé exige canEdit (verrou
// admin), pour éviter qu'un comptable annule un encaissement sans validation.
export async function toggleFraisAnnexe(_id, opts, {
  readOnly, canEdit, toast, modEleves, logAction,
  ajPaiement = null, annee = "", auteur = "", eleve = null,
}) {
  // `confirmer:false` : la question a déjà été posée UNE fois pour tout un
  // lot (encaissement groupé des inscriptions). Sans cela, réinscrire une
  // classe de 50 élèves ouvrirait 50 fenêtres de confirmation.
  const { payKey, dateKey, fraisId=null, fraisPayesActuels=null, valeurActuelle=false, label, montant=0, nomEleve="", confirmer=true } = opts;
  if(readOnly) return;
  if(valeurActuelle && !canEdit){
    toast(`Le retrait de ${label.toLowerCase()} nécessite l'autorisation de l'administrateur (verrou activé).`,"warning");
    return;
  }
  const montantLabel = montant>0 ? ` (${fmt(montant)})` : "";
  const message = valeurActuelle
    ? `Retirer ${label.toLowerCase()}${montantLabel} pour ${nomEleve} ?`
    : `Marquer ${label.toLowerCase()}${montantLabel} comme payé pour ${nomEleve} ?`;
  if(confirmer && !confirm(message)) return;
  if (fraisId) {
    const fraisPayes = { ...(fraisPayesActuels || {}) };
    if (valeurActuelle) delete fraisPayes[fraisId];
    else fraisPayes[fraisId] = new Date().toLocaleDateString("fr-FR");
    await modEleves(_id, { fraisPayes });
  } else {
    await modEleves(_id,{
      [payKey]:!valeurActuelle,
      [dateKey]:!valeurActuelle ? new Date().toLocaleDateString("fr-FR") : null,
    });
  }
  // Journal d'audit : chaque encaissement/retrait de frais laisse une trace.
  logAction?.(
    valeurActuelle ? "Frais annexe retiré" : "Frais annexe encaissé",
    `${nomEleve} · ${label}${montant>0?` · ${fmt(montant)}`:""}`,
  );
  // Grand livre : l'inscription et les frais annexes sont des encaissements
  // au même titre que les mensualités.
  const estInscription = payKey === "inscriptionPayee";
  const params = {
    annee,
    eleve: eleve || { _id, nom: nomEleve },
    type: estInscription ? "inscription" : "frais",
    mois: estInscription ? "inscription" : (fraisId || payKey || "autre"),
    libelle: label,
    montant,
    auteur,
  };
  await journaliser(ajPaiement, valeurActuelle ? ecritureAnnulation(params) : ecritureEncaissement(params), toast);
}

// Toggle de mensualité d'un élève (Payé/Impayé) avec push parent.
// Le décochage exige le verrou admin (canEdit) ; le push de confirmation
// est envoyé au parent dans les 2 sens (payé → confirmation, impayé → rappel).
// Le MONTANT du tarif en vigueur est figé au moment du paiement
// (mensMontants[mois]) : un changement de tarif en cours d'année ne
// réécrit plus rétroactivement les totaux perçus.
export async function toggleMens(_id, mois, mensActuels, mensDatesActuels, nomEleve, {
  readOnly, canEdit, toast, modEleves, envoyerPush, logAction, montantMois = null, mensMontantsActuels = null,
  ajPaiement = null, annee = "", auteur = "", eleve = null,
}) {
  if(readOnly) return;
  const mens={...(mensActuels||initMens())};
  const estPaye=mens[mois]==="Payé";
  if(estPaye && !canEdit){
    toast("Le décochage nécessite l'autorisation de l'administrateur (verrou activé).","warning");
    return;
  }
  const msg = estPaye
    ? `Décocher ${mois} et marquer comme impayé pour ${nomEleve||""} ?`
    : `Marquer ${mois} comme payé pour ${nomEleve||""} ?`;
  if(!confirm(msg)) return;
  mens[mois]=estPaye?"Impayé":"Payé";
  const mensDates={...(mensDatesActuels||{})};
  const mensMontants={...(mensMontantsActuels||{})};
  if(!estPaye){
    mensDates[mois]=new Date().toLocaleDateString("fr-FR");
    if(Number.isFinite(Number(montantMois))) mensMontants[mois]=Number(montantMois);
  } else {
    delete mensDates[mois];
    delete mensMontants[mois];
  }
  await modEleves(_id,{mens,mensDates,mensMontants});
  // Journal d'audit : chaque encaissement ET chaque décochage laisse une
  // trace (élève, mois, montant) — cœur de la promesse de traçabilité.
  const montantJournal = Number.isFinite(Number(montantMois)) && Number(montantMois) > 0
    ? ` · ${fmt(Number(montantMois))}`
    : "";
  logAction?.(
    estPaye ? "Mensualité décochée (impayé)" : "Mensualité encaissée",
    `${nomEleve||"Élève"} · ${mois}${montantJournal}`,
  );
  // Grand livre : le décochage n'efface pas la ligne d'encaissement, il ajoute
  // une contre-passation. C'est ce qui permet à la caisse de rester juste et à
  // l'historique de survivre à la clôture d'année.
  const montantLigne = Number.isFinite(Number(montantMois)) ? Number(montantMois) : 0;
  const params = {
    annee,
    eleve: eleve || { _id, nom: nomEleve },
    type: "mensualite",
    mois,
    libelle: mois,
    montant: mensMontantsActuels?.[mois] ?? montantLigne,
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
