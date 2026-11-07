import { useState } from "react";
import { fmtN } from "../../../constants";
import { imprimerListePayes } from "../../../reports";
import { Btn, Modale } from "../../ui";
import { TRIS_AYANT_PAYE, TRI_AYANT_PAYE_DEFAUT, libelleTriAyantPaye, trierAyantPaye } from "./alerte-mensualites";

// Ordre de la liste « Ont payé » : préférence de l'APPAREIL, gardée d'une
// impression à l'autre (comme le nombre de préavis par page).
const CLE_TRI = "LC_triListePayes";
const lireTri = () => {
  try {
    const tri = JSON.parse(localStorage.getItem(CLE_TRI) || "null");
    return TRIS_AYANT_PAYE.some((t) => t.id === tri?.critere) && ["asc", "desc"].includes(tri?.sens)
      ? tri : { ...TRI_AYANT_PAYE_DEFAUT };
  } catch { return { ...TRI_AYANT_PAYE_DEFAUT }; }
};
const garderTri = (tri) => {
  try { localStorage.setItem(CLE_TRI, JSON.stringify(tri)); } catch { /* mode privé : défaut */ }
};

const Choix = ({ nom, actif, onChange, children }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, padding: "5px 10px", cursor: "pointer",
    border: `1px solid ${actif ? "#1d4ed8" : "var(--lc-border, #cbd5e1)"}`, borderRadius: 8 }}>
    <input type="radio" name={nom} checked={actif} onChange={onChange} />{children}
  </label>
);

// Avant d'imprimer la liste des élèves ayant payé : critère de classement
// (mois payés, montant perçu, nom) et sens, avec un aperçu des premiers.
export function ListePayesModale({ lignes, options, monnaie, fermer }) {
  const [tri, setTri] = useState(lireTri);
  const tries = trierAyantPaye(lignes, tri);
  const parNom = tri.critere === "nom";

  return (
    <Modale titre="✅ Élèves ayant payé — classement" fermer={fermer}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Trier par</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TRIS_AYANT_PAYE.map((t) => (
          <Choix key={t.id} nom="critere-payes" actif={tri.critere === t.id} onChange={() => setTri((x) => ({ ...x, critere: t.id }))}>{t.label}</Choix>
        ))}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, margin: "14px 0 6px" }}>Ordre</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Choix nom="sens-payes" actif={tri.sens === "asc"} onChange={() => setTri((x) => ({ ...x, sens: "asc" }))}>
          {parNom ? "De A à Z" : "Croissant (du plus petit au plus grand)"}
        </Choix>
        <Choix nom="sens-payes" actif={tri.sens === "desc"} onChange={() => setTri((x) => ({ ...x, sens: "desc" }))}>
          {parNom ? "De Z à A" : "Décroissant (du plus grand au plus petit)"}
        </Choix>
      </div>
      <div style={{ fontSize: 11.5, color: "#64748b", margin: "12px 0 4px" }}>Aperçu — {lignes.length} élève(s) :</div>
      <ol style={{ margin: 0, paddingInlineStart: 22, fontSize: 12, lineHeight: 1.6 }}>
        {tries.slice(0, 5).map(({ eleve: e, mois, montant }) => (
          <li key={e._id}><strong>{e.nom} {e.prenom}</strong> · {e.classe} · {mois.length} mois · {fmtN(montant)} {monnaie}</li>
        ))}
        {tries.length > 5 && <li style={{ listStyle: "none", color: "#64748b" }}>…</li>}
      </ol>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn onClick={() => {
          garderTri(tri);
          imprimerListePayes(tries, { ...options, tri: libelleTriAyantPaye(tri) });
          fermer();
        }}>🖨️ Imprimer</Btn>
      </div>
    </Modale>
  );
}
