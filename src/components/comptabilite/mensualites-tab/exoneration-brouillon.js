// Brouillon de la modale « Dispenses de paiement » : ce que la Direction est
// en train de saisir, avant confirmation. Un poste COCHÉ et son TAUX y sont
// deux choses distinctes. Tant qu'ils ne faisaient qu'un (taux 0 = poste
// décoché), vider le champ pour retaper un taux décochait le poste et grisait
// la case sous les doigts ; recocher rendait alors l'étape « 1 » de
// l'effacement, soit une dispense de 1 %.
import { POSTES_EXONERABLES } from "../../../exoneration-utils";

const TAUX_PAR_DEFAUT = 100;
const DISPENSE_PAR_DEFAUT = { mensualites: 100, inscription: 100, fraisAnnexes: 0, motif: "personnel" };

// Brouillon de départ : celui de la dispense en cours s'il y en a une — la
// modifier ne doit pas obliger à tout ressaisir — sinon mensualités et
// inscription à 100 %. Un poste non dispensé garde 100 % en réserve, le taux
// proposé si on le coche.
export function brouillonDepuis(exoneration = null) {
  const exo = exoneration || DISPENSE_PAR_DEFAUT;
  const taux = (poste) => Number(exo[poste]) || 0;
  return {
    actifs: Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, taux(poste) > 0])),
    taux: Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, taux(poste) || TAUX_PAR_DEFAUT])),
    motif: exo.motif || DISPENSE_PAR_DEFAUT.motif,
    precision: exo.precision || "",
  };
}

// Forme attendue par accorderExoneration : un taux par poste, 0 pour un poste
// décoché — même s'il garde en mémoire le taux qu'il avait.
export function versExoneration(brouillon) {
  return {
    ...Object.fromEntries(POSTES_EXONERABLES.map((poste) => [poste, brouillon.actifs[poste] ? brouillon.taux[poste] : 0])),
    motif: brouillon.motif,
    precision: brouillon.precision,
  };
}
