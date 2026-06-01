import { EcoleTabsPedago } from "./tab-content/EcoleTabsPedago";
import { EcoleTabsAdmin } from "./tab-content/EcoleTabsAdmin";

// Aiguillage du contenu selon l'onglet actif (e.tab). Toute la logique vit
// dans useEcole (objet `e`) ; ce composant ne fait que router vers les deux
// groupes d'onglets (pédagogie + gestion), qui n'affichent que l'onglet actif.
export function EcoleTabContent(props) {
  return (
    <>
      <EcoleTabsPedago {...props} />
      <EcoleTabsAdmin {...props} />
    </>
  );
}
