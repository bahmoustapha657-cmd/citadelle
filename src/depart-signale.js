// ════════════════════════════════════════════════════════════════════════
//  Départs signalés — le chef de section signale, la comptabilité confirme
// ════════════════════════════════════════════════════════════════════════
// Un élève qui quitte l'école (transfert accordé par le directeur, abandon,
// exclusion, décès) passe d'abord par le chef de section ou la Direction.
// Tant que la comptabilité ne le sait pas, il reste « Actif » chez elle et
// continue de devoir ses mensualités. Le signalement fait le pont : le chef
// de section dit qui part, comment et depuis quand ; la comptable confirme
// (la fiche devient un départ, cf. depart-utils) ou refuse en disant
// pourquoi.
//
// Il vit sur la fiche de l'élève (`eleve.departSignale`, dans extra : aucune
// migration), comme la demande de dispense. Un seul signalement par élève :
// en renvoyer un remplace le précédent.
//
// Il porte son année scolaire et ne compte que pour elle : un signalement
// resté sans réponse ne ressurgit pas l'année suivante.

// Extension explicite : module couvert par des tests Node.
import { STATUTS_SORTIE, estSorti } from "./constants.js";
import { lireDate, normaliserDepart } from "./depart-utils.js";

// Départs qu'on signale : le diplôme se constate en fin d'année, il ne se
// signale pas.
export const STATUTS_SIGNALABLES = STATUTS_SORTIE.filter((s) => s !== "Diplômé"); // i18n-ignore
export const SIGNALE_ATTENTE = "attente";
export const SIGNALE_REFUSE = "refuse";

const texte = (v) => String(v ?? "").trim();

// Forme retenue, ou null si le signalement ne dit pas qui part ni quand :
// le départ proposé (statut, date, motif, école d'accueil pour un
// transfert), qui l'a signalé, et la réponse de la comptabilité si elle l'a
// refusé.
export function normaliserSignalement(brut) {
  if (!brut || typeof brut !== "object") return null;
  const statut = texte(brut.statut);
  if (!STATUTS_SIGNALABLES.includes(statut)) return null;
  const dateDepart = texte(brut.dateDepart);
  if (!lireDate(dateDepart)) return null;
  const refuse = brut.etat === SIGNALE_REFUSE;
  return {
    statut,
    dateDepart,
    motifDepart: texte(brut.motifDepart),
    destinationDepart: statut === "Transféré" ? texte(brut.destinationDepart) : "", // i18n-ignore
    annee: texte(brut.annee),
    signalePar: texte(brut.signalePar),
    signaleParRole: texte(brut.signaleParRole),
    signaleLe: texte(brut.signaleLe),
    etat: refuse ? SIGNALE_REFUSE : SIGNALE_ATTENTE,
    refusePar: refuse ? texte(brut.refusePar) : "",
    refuseLe: refuse ? texte(brut.refuseLe) : "",
    motifRefus: refuse ? texte(brut.motifRefus) : "",
  };
}

// Le signalement de l'année `annee` (toutes années si `annee` est vide).
export function getSignalement(eleve = {}, annee = "") {
  const signalement = normaliserSignalement(eleve?.departSignale);
  if (!signalement) return null;
  if (annee && signalement.annee !== annee) return null;
  return signalement;
}

// Un élève déjà parti n'a plus rien à confirmer : son départ a été déclaré
// autrement (par la comptabilité elle-même, ou un signalement confirmé).
export const signalementEnAttente = (eleve, annee) => !estSorti(eleve) && getSignalement(eleve, annee)?.etat === SIGNALE_ATTENTE;
export const signalementRefuse = (eleve, annee) => getSignalement(eleve, annee)?.etat === SIGNALE_REFUSE;

export const elevesSignalesEnAttente = (eleves = [], annee = "") => eleves.filter((e) => signalementEnAttente(e, annee));
export const elevesSignalementRefuse = (eleves = [], annee = "") => eleves.filter((e) => signalementRefuse(e, annee));

// Signalements à confirmer, section par section ({ total, parSection }) :
// tableau de bord et pastille de la comptabilité. `parSection` ne garde que
// les sections qui en ont, la plus chargée d'abord.
export function compterSignalementsParSection(elevesParSection = {}, annee = "") {
  const parSection = Object.entries(elevesParSection)
    .map(([section, eleves]) => ({ section, nombre: elevesSignalesEnAttente(eleves || [], annee).length }))
    .filter((s) => s.nombre > 0)
    .sort((a, b) => b.nombre - a.nombre);
  return { total: parSection.reduce((s, x) => s + x.nombre, 0), parSection };
}

// Signalement à enregistrer, à partir de ce que le chef de section a saisi.
// { signalement } ou { erreur } : "eleve" (aucun élève choisi), "dejaParti",
// "statut", "date".
export function nouveauSignalement(eleve, saisie = {}, { annee = "", auteur = "", role = "", date = "" } = {}) {
  if (!eleve?._id) return { erreur: "eleve" };
  if (estSorti(eleve)) return { erreur: "dejaParti" };
  if (!STATUTS_SIGNALABLES.includes(texte(saisie.statut))) return { erreur: "statut" };
  if (!lireDate(saisie.dateDepart)) return { erreur: "date" };
  return {
    signalement: normaliserSignalement({
      ...saisie,
      annee,
      signalePar: auteur,
      signaleParRole: role,
      signaleLe: date,
      etat: SIGNALE_ATTENTE,
    }),
  };
}

// Le même signalement, refusé : le chef de section le retrouve avec la
// raison du refus jusqu'à ce qu'il le retire de sa liste.
export function refuserSignalement(signalement, { motifRefus = "", auteur = "", date = "" } = {}) {
  return normaliserSignalement({
    ...signalement,
    etat: SIGNALE_REFUSE,
    motifRefus,
    refusePar: auteur,
    refuseLe: date,
  });
}

// Ce que la comptabilité écrit sur la fiche en confirmant : le départ
// (mêmes règles que le formulaire de l'élève, cf. normaliserDepart), et le
// signalement retiré. null si le signalement ne se lit pas.
export function champsConfirmation(signalement) {
  const s = normaliserSignalement(signalement);
  if (!s) return null;
  const { fiche, erreur } = normaliserDepart({
    statut: s.statut,
    dateDepart: s.dateDepart,
    motifDepart: s.motifDepart || null,
    destinationDepart: s.destinationDepart || null,
  });
  if (erreur) return null;
  return { ...fiche, departSignale: null };
}
