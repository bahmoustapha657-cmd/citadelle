import { Vide } from "../../ui";
import { MensualitesSynthese } from "./MensualitesSynthese";
import { MensualitesRow } from "./MensualitesRow";

// Tableau sticky des mensualités : bandeau de synthèse, état vide, puis grille
// scrollable (en-tête figé en haut, colonnes Matricule/Nom figées à gauche).
export function MensualitesTable({
  eleves, elevesFiltres, moisAnnee, tarifsClasses, readOnly, canCreate, canEdit,
  schoolInfo, toggleMens, toggleFraisAnnexe, getTarifInscriptionEleve, getTarifAutre, getTarif,
  getTarifFraisDivers,
}) {
  if (eleves.length === 0) return <Vide icone="🎓" msg="Aucun élève" />;

  return (
    <>
      <MensualitesSynthese elevesFiltres={elevesFiltres} moisAnnee={moisAnnee} tarifsClasses={tarifsClasses} />
      {/* Conteneur scroll : maxHeight pour activer sticky top sur l'en-tête,
          overflow:auto pour activer sticky left sur les 2 premières colonnes
          (Matricule + Nom). Le scroll vertical reste fluide dans la table sans
          que l'utilisateur perde le contexte. */}
      <div style={{
        maxHeight: "calc(100vh - 320px)",
        minHeight: 300,
        overflow: "auto",
        border: "1px solid var(--lc-border)",
        borderRadius: 8,
      }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, minWidth: 1080 }}>
          {(() => {
            // Styles partagés des en-têtes (gradient + texte clair) avec sticky-top.
            // Les 2 premières colonnes ajoutent sticky-left → coin haut-gauche
            // (z-index 3 pour passer au-dessus des autres TH).
            const thBase = {
              textAlign: "start", padding: "10px 13px", fontSize: 10, fontWeight: 700,
              color: "rgba(255,255,255,0.9)", textTransform: "uppercase", letterSpacing: "0.08em",
              whiteSpace: "nowrap", borderBottom: "2px solid var(--sc2)",
              background: "linear-gradient(135deg,var(--sc1),var(--sc1-dk))",
              position: "sticky", top: 0,
            };
            const thStickyLeft = (left, z = 3) => ({ ...thBase, left, zIndex: z });
            const cols = ["Matricule", "Nom & Prénom", "Classe", "Tuteur", "Contact", ...moisAnnee, "Payés", "Ins.", "Frais", "Reçu"];
            return (
              <thead>
                <tr>
                  <th style={thStickyLeft(0)}>{cols[0]}</th>
                  <th style={thStickyLeft(95)}>{cols[1]}</th>
                  {cols.slice(2).map((c, i) => (
                    <th key={i} style={{ ...thBase, zIndex: 2 }}>{c}</th>
                  ))}
                </tr>
              </thead>
            );
          })()}
          <tbody>{elevesFiltres.map((e, rowIdx) => (
            <MensualitesRow
              key={e._id} e={e} rowIdx={rowIdx} moisAnnee={moisAnnee} tarifsClasses={tarifsClasses}
              readOnly={readOnly} canCreate={canCreate} canEdit={canEdit} schoolInfo={schoolInfo}
              toggleMens={toggleMens} toggleFraisAnnexe={toggleFraisAnnexe}
              getTarifInscriptionEleve={getTarifInscriptionEleve} getTarifAutre={getTarifAutre} getTarif={getTarif}
              getTarifFraisDivers={getTarifFraisDivers}
            />
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
