import { createRoot } from "react-dom/client";
import { FenetreMotif } from "./FenetreMotif";

// Demande le motif d'un décochage / retrait d'encaissement (cf.
// FenetreMotif). Appelée depuis payment-actions, hors React : rendu
// impératif, la promesse rend { motif, explication } ou null si l'on annule.
export function demanderMotifAnnulation({ titre = "Retirer un paiement", message = "" } = {}) {
  return new Promise((resolve) => {
    const hote = document.createElement("div");
    document.body.appendChild(hote);
    const racine = createRoot(hote);
    const fin = (resultat) => {
      racine.unmount();
      hote.remove();
      resolve(resultat);
    };
    racine.render(<FenetreMotif titre={titre} message={message} fin={fin} />);
  });
}
