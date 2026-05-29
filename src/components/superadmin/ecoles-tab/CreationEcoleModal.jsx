import { C } from "../../../constants";

// Modale de création d'une nouvelle école (nom/ville/pays + aperçu du slug).
export function CreationEcoleModal({ nouvelleEcole, setNouvelleEcole, genSlug, creerEcole, setCreationOuverte, S }) {
  return (
    <div style={S.overlay} onClick={() => setCreationOuverte(false)}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: "0 0 16px", color: C.blueDark, fontSize: 17 }}>Creer une nouvelle ecole</h3>
        {[
          { label: "Nom de l'ecole *", key: "nom", placeholder: "Ex. : Ecole Les Etoiles" },
          { label: "Ville *", key: "ville", placeholder: "Ex. : Conakry" },
          { label: "Pays", key: "pays", placeholder: "Ex. : Guinee" },
        ].map(({ label, key, placeholder }) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</label>
            <input value={nouvelleEcole[key]} onChange={e => setNouvelleEcole(p => ({ ...p, [key]: e.target.value }))}
              placeholder={placeholder} style={{ ...S.input, width: "100%" }} />
          </div>
        ))}
        {nouvelleEcole.nom && (
          <div style={{ background: "#f0f4f8", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
            Code ecole genere : <strong style={{ color: C.blue }}>{genSlug(nouvelleEcole.nom)}</strong>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
          <button onClick={() => setCreationOuverte(false)}
            style={{ background: "#f3f4f6", border: "none", padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 600, color: "#6b7280" }}>
            Annuler
          </button>
          <button onClick={creerEcole} disabled={!nouvelleEcole.nom.trim() || !nouvelleEcole.ville.trim()}
            style={{
              background: `linear-gradient(90deg,${C.blue},${C.green})`, border: "none", color: "#fff",
              padding: "9px 18px", borderRadius: 8, cursor: "pointer", fontWeight: 700,
              opacity: (!nouvelleEcole.nom.trim() || !nouvelleEcole.ville.trim()) ? 0.5 : 1,
            }}>
            Creer l'ecole
          </button>
        </div>
      </div>
    </div>
  );
}
