import { useEffect, useState } from "react";
import {
  EVENEMENT_A_REGULARISER, grouperParEleve, lireARegulariser, retirerARegulariser,
} from "../../backend/refus-ecriture";

const formatGnf = (n) => Number(n || 0).toLocaleString("fr-FR");

// ══════════════════════════════════════════════════════════════
//  Bandeau « saisies refusées par le serveur — à régulariser »
// ══════════════════════════════════════════════════════════════
// Une inscription ou un encaissement refusé à l'envoi disparaissait de
// l'écran à la synchro suivante, alors que le reçu avait été remis à la
// famille (cf. refus-ecriture.js). Il reste désormais affiché ici, sur
// l'appareil qui l'a saisi, jusqu'à ce que la comptable le marque régularisé.
// Le même refus est aussi écrit dans le journal de l'école (Historique).
export function BandeauARegulariser({ t }) {
  const [entrees, setEntrees] = useState(() => lireARegulariser());
  const [ouvert, setOuvert] = useState(true);

  useEffect(() => {
    const relire = () => setEntrees(lireARegulariser());
    window.addEventListener(EVENEMENT_A_REGULARISER, relire);
    window.addEventListener("storage", relire);
    return () => {
      window.removeEventListener(EVENEMENT_A_REGULARISER, relire);
      window.removeEventListener("storage", relire);
    };
  }, []);

  const groupes = grouperParEleve(entrees);
  if (!groupes.length) return null;

  const regulariser = (groupe) => {
    if (!window.confirm(t("refusServeur.confirmer", { nom: groupe.nom }))) return;
    setEntrees(retirerARegulariser(groupe.ids));
  };

  const bouton = {
    border: "1px solid #fca5a5", background: "#fff", color: "#991b1b", borderRadius: 6,
    padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
  };

  return (
    <div role="alert" style={{ background: "#fef2f2", borderBottom: "1px solid #fca5a5", color: "#991b1b", padding: "8px 16px", fontSize: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800 }}>
        <span style={{ fontSize: 15 }} aria-hidden="true">⚠️</span>
        <span style={{ flex: 1, minWidth: 0 }}>{t("refusServeur.titre", { nombre: groupes.length })}</span>
        <button type="button" style={bouton} onClick={() => setOuvert((o) => !o)}>
          {ouvert ? t("refusServeur.masquer") : t("refusServeur.afficher")}
        </button>
      </div>
      {ouvert && (
        <>
          <p style={{ margin: "6px 0", fontWeight: 600, lineHeight: 1.45 }}>{t("refusServeur.consigne")}</p>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, maxHeight: 240, overflowY: "auto" }}>
            {groupes.map((g) => (
              <li key={g.cle} style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 10px", display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200, lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 800 }}>
                    {g.nom || "?"}{g.classe ? ` — ${g.classe}` : ""}{g.matricule ? ` (${g.matricule})` : ""}
                  </div>
                  {g.inscription && <div>{t("refusServeur.ficheNonEnregistree")}</div>}
                  {g.encaissements.length > 0 && (
                    <div>
                      {t("refusServeur.encaissements", {
                        liste: g.encaissements.map((e) => `${e.libelle} ${formatGnf(e.montant)}`).join(", "),
                        total: formatGnf(g.total),
                      })}
                    </div>
                  )}
                  {g.motif && <div style={{ color: "#7f1d1d" }}>{t("refusServeur.motif", { motif: g.motif })}</div>}
                </div>
                <button type="button" style={bouton} title={t("refusServeur.regulariseAide")} onClick={() => regulariser(g)}>
                  ✓ {t("refusServeur.regularise")}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
