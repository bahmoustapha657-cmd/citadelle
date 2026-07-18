// Accès aux tarifs par classe : getters liés à la liste tarifsClasses et
// construction du document tarif à enregistrer. Logique pure.
import {
  getTarifAutreForClasse,
  getTarifBaseForClasse,
  getTarifConfigForClasse,
  getTarifInscriptionForClasse,
  getTarifInscriptionForEleve,
  getTarifMensuelForClasse,
  getTarifReinscriptionForClasse,
  getTarifRevisionForClasse,
} from "../../mensualite-utils";
import { CATALOGUE_FRAIS_ANNEXES, getTarifFraisDivers } from "../../constants";

// Lie tous les getters de tarif à la liste tarifsClasses courante.
export function buildTarifGetters(tarifsClasses) {
  return {
    getTarifConfig: (classe) => getTarifConfigForClasse(tarifsClasses, classe),
    getTarif: (classe) => getTarifMensuelForClasse(tarifsClasses, classe),
    getTarifBase: (classe) => getTarifBaseForClasse(tarifsClasses, classe),
    getTarifRevision: (classe) => getTarifRevisionForClasse(tarifsClasses, classe),
    getTarifAutre: (classe) => getTarifAutreForClasse(tarifsClasses, classe),
    getTarifIns: (classe) => getTarifInscriptionForClasse(tarifsClasses, classe),
    getTarifReinsc: (classe) => getTarifReinscriptionForClasse(tarifsClasses, classe),
    getTarifInscriptionEleve: (eleve = {}) => getTarifInscriptionForEleve(eleve, tarifsClasses),
    getTarifFraisDivers: (classe) => getTarifFraisDivers(getTarifConfigForClasse(tarifsClasses, classe) || {}),
  };
}

// Frais divers normalisés pour l'enregistrement : ids du catalogue seulement
// (hors « autre »), montants numériques, les 0 sont conservés pour permettre
// la désactivation d'un frais.
export function normalizeFraisDivers(fraisDivers = {}) {
  return CATALOGUE_FRAIS_ANNEXES.reduce((acc, f) => {
    if (f.id === "autre") return acc;
    if (fraisDivers[f.id] === undefined || fraisDivers[f.id] === "") return acc;
    acc[f.id] = Number(fraisDivers[f.id]) || 0;
    return acc;
  }, {});
}

// Document tarif : montant mensuel obligatoire, autres champs seulement
// si fournis (null = ne pas écraser).
export function buildTarifData(montant, { inscription = null, reinscription = null, revision = null, autre = null, fraisDivers = null } = {}) {
  return {
    montant: Number(montant) || 0,
    ...(inscription !== null ? { inscription: Number(inscription) || 0 } : {}),
    ...(reinscription !== null ? { reinscription: Number(reinscription) || 0 } : {}),
    ...(revision !== null ? { revision: Number(revision) || 0 } : {}),
    ...(autre !== null ? { autre: Number(autre) || 0 } : {}),
    ...(fraisDivers !== null ? { fraisDivers: normalizeFraisDivers(fraisDivers) } : {}),
  };
}
