// ════════════════════════════════════════════════════════════════════════
//  Demandes de dispense — la comptabilité signale, la Direction décide
// ════════════════════════════════════════════════════════════════════════
// Une dispense efface une dette : seule la Direction l'accorde (cf.
// exoneration-actions). Mais c'est la comptabilité qui voit les familles au
// guichet et sait qui ne peut plus payer. La demande fait le pont : la
// comptable remplit la dispense qu'elle propose (postes, taux, motif), la
// Direction l'accorde telle quelle, la corrige avant de l'accorder, ou la
// refuse en écrivant pourquoi.
//
// Elle vit sur la fiche de l'élève (`eleve.demandeDispense`, dans extra :
// aucune migration), comme la dispense elle-même. Une seule demande par
// élève : en renvoyer une remplace la précédente.
//
// Elle porte son année scolaire et ne compte que pour elle : une demande
// restée sans réponse ne ressurgit pas l'année suivante, où la situation de
// la famille doit être réexaminée de toute façon.

// Extension explicite : module couvert par des tests Node.
import { normaliserExoneration } from "./exoneration-utils.js";

export const STATUT_ATTENTE = "attente";
export const STATUT_REFUSEE = "refusee";

const texte = (v) => String(v ?? "").trim();

// Forme retenue, ou null si la demande ne dispense de rien : mêmes taux,
// motif et précision qu'une dispense, plus qui l'a demandée, et la réponse
// de la Direction si elle l'a refusée.
export function normaliserDemande(brut) {
  if (!brut || typeof brut !== "object") return null;
  const exo = normaliserExoneration(brut);
  if (!exo) return null;
  const refusee = brut.statut === STATUT_REFUSEE;
  return {
    mensualites: exo.mensualites,
    inscription: exo.inscription,
    fraisAnnexes: exo.fraisAnnexes,
    motif: exo.motif,
    precision: exo.precision,
    annee: exo.annee,
    demandeePar: texte(brut.demandeePar),
    demandeeLe: texte(brut.demandeeLe),
    statut: refusee ? STATUT_REFUSEE : STATUT_ATTENTE,
    refuseePar: refusee ? texte(brut.refuseePar) : "",
    refuseeLe: refusee ? texte(brut.refuseeLe) : "",
    motifRefus: refusee ? texte(brut.motifRefus) : "",
  };
}

// La demande de l'année `annee` (toutes années si `annee` est vide).
export function getDemande(eleve = {}, annee = "") {
  const demande = normaliserDemande(eleve?.demandeDispense);
  if (!demande) return null;
  if (annee && demande.annee !== annee) return null;
  return demande;
}

export const demandeEnAttente = (eleve, annee) => getDemande(eleve, annee)?.statut === STATUT_ATTENTE;
export const demandeRefusee = (eleve, annee) => getDemande(eleve, annee)?.statut === STATUT_REFUSEE;

export const elevesDemandeEnAttente = (eleves = [], annee = "") => eleves.filter((e) => demandeEnAttente(e, annee));
export const elevesDemandeRefusee = (eleves = [], annee = "") => eleves.filter((e) => demandeRefusee(e, annee));

// Demandes en attente, section par section ({ college: [...], primaire: [...] }) :
// le tableau de bord de la Direction et la pastille du bouton « Dispenses »
// couvrent toute l'école, la fenêtre ne montre que la section affichée.
// `parSection` ne garde que les sections qui en ont, la plus chargée d'abord.
export function compterDemandesParSection(elevesParSection = {}, annee = "") {
  const parSection = Object.entries(elevesParSection)
    .map(([section, eleves]) => ({ section, nombre: elevesDemandeEnAttente(eleves || [], annee).length }))
    .filter((s) => s.nombre > 0)
    .sort((a, b) => b.nombre - a.nombre);
  return { total: parSection.reduce((s, x) => s + x.nombre, 0), parSection };
}

// Demande à enregistrer, à partir de la dispense proposée (forme de
// versExoneration). null si elle ne dispense de rien.
export function nouvelleDemande(proposition, { annee = "", auteur = "", date = "" } = {}) {
  return normaliserDemande({
    ...proposition,
    annee,
    demandeePar: auteur,
    demandeeLe: date,
    statut: STATUT_ATTENTE,
  });
}

// La même demande, refusée : la comptable la retrouve avec la raison du refus
// jusqu'à ce qu'elle la retire de sa liste.
export function refuserDemande(demande, { motifRefus = "", auteur = "", date = "" } = {}) {
  return normaliserDemande({
    ...demande,
    statut: STATUT_REFUSEE,
    motifRefus,
    refuseePar: auteur,
    refuseeLe: date,
  });
}

// La dispense que la Direction accorde en acceptant la demande telle quelle.
export function exonerationDepuisDemande(demande) {
  if (!demande) return null;
  const { mensualites, inscription, fraisAnnexes, motif, precision } = demande;
  return { mensualites, inscription, fraisAnnexes, motif, precision };
}
