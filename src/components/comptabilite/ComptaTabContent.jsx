import { ComptaTabsFinancier } from "./tab-content/ComptaTabsFinancier";
import { ComptaTabsScolarite } from "./tab-content/ComptaTabsScolarite";

// Aiguillage du contenu selon l'onglet actif (c.tab). La logique vit dans
// useComptabilite (objet `c`) ; ce composant route vers les deux groupes
// d'onglets (financier + scolarité), qui n'affichent que l'onglet actif.
export function ComptaTabContent(props) {
  return (
    <>
      <ComptaTabsFinancier {...props} />
      <ComptaTabsScolarite {...props} />
    </>
  );
}
