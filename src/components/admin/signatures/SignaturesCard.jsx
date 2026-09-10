import { C } from "../../../constants";
import { MatriceSignatures } from "./MatriceSignatures";
import { useSignaturesCard } from "./use-signatures-card";

// ══════════════════════════════════════════════════════════════
//  Qui signe quoi — matrice des signatures des documents imprimés
// ══════════════════════════════════════════════════════════════
export function SignaturesCard({ schoolId, peutGererRoles, toast }) {
  const s = useSignaturesCard({ schoolId, toast });

  return (
    <div style={{ background: "var(--lc-surface, #fff)", borderRadius: 14, padding: "20px 22px", marginBottom: 20, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.blueDark }}>🖋️ Qui signe quoi</h3>
      <p style={{ margin: "3px 0 12px", fontSize: 12, color: "#64748b" }}>
        Choisissez le poste qui signe chaque document — y compris les postes que vous avez créés.
        Le responsable du poste s'imprime sous son titre. Un second signataire (visa) peut s'ajouter.
        {!peutGererRoles && <><br/>Réglage réservé à la Direction Générale.</>}
      </p>
      {s.chargement
        ? <p style={{ fontSize: 12, color: "#94a3b8" }}>Chargement des postes…</p>
        : <MatriceSignatures s={s} peutGererRoles={peutGererRoles} />}
    </div>
  );
}
