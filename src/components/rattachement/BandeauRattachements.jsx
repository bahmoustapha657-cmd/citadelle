import { lazy, Suspense, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { estEspaceEnseignant } from "../../espace-enseignant";
import { rattachementsRecus } from "../../backend/rattachement-supabase";

const RattachementModale = lazy(() => import("./RattachementModale").then((m) => ({ default: m.RattachementModale })));

// ══════════════════════════════════════════════════════════════
//  Bandeau « un enseignant propose de rattacher ses classes »
// ══════════════════════════════════════════════════════════════
// Direction d'une école seulement, en ligne : un enseignant qui tenait ses
// classes dans son espace personnel propose de les rattacher à l'école
// (étape 3). La direction examine, relie ses élèves et accepte ou refuse.
export function BandeauRattachements({ utilisateur, schoolInfo, estHorsLigne }) {
  const { t } = useTranslation();
  const actif = utilisateur?.role === "direction" && !estEspaceEnseignant(schoolInfo) && !estHorsLigne;
  const [lues, setLues] = useState([]);
  const [ouverte, setOuverte] = useState(null);
  // Relu après chaque demande traitée.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!actif) return undefined;
    let vivant = true;
    rattachementsRecus().then((d) => { if (vivant) setLues(d); });
    return () => { vivant = false; };
  }, [actif, version]);
  const demandes = actif ? lues : [];

  if (!demandes.length && !ouverte) return null;

  const bouton = {
    border: "1px solid #93c5fd", background: "#fff", color: "#1e40af", borderRadius: 6,
    padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
  };

  return (
    <>
      {demandes.length > 0 && (
        <div role="status" style={{ background: "#eff6ff", borderBottom: "1px solid #bfdbfe", color: "#1e3a8a", padding: "8px 16px", fontSize: 12.5, display: "grid", gap: 6 }}>
          {demandes.map((d) => (
            <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span aria-hidden="true" style={{ fontSize: 15 }}>📥</span>
              <span style={{ flex: 1, minWidth: 200, fontWeight: 700, lineHeight: 1.45 }}>
                {t("rattachement.banner", {
                  enseignant: d.enseignant, etablissement: d.etablissement, classes: d.nb_classes, eleves: d.nb_eleves,
                })}
              </span>
              <button type="button" style={bouton} onClick={() => setOuverte(d)}>{t("rattachement.review")}</button>
            </div>
          ))}
        </div>
      )}
      {ouverte && (
        <Suspense fallback={null}>
          <RattachementModale
            demande={ouverte}
            fermer={() => setOuverte(null)}
            onTraitee={() => { setOuverte(null); setVersion((v) => v + 1); }}
          />
        </Suspense>
      )}
    </>
  );
}
