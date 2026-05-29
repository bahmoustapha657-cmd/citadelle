import { Badge } from "../ui";

// Bandeau supérieur du portail parent : logo/nom de l'école + identité du
// compte parent et déconnexion.
export function PortailHeader({ schoolInfo, annee, utilisateur, deconnecter, c1, c2 }) {
  return (
    <div style={{ background: `linear-gradient(135deg,${c1},${c1}ee)`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
      {schoolInfo.logo && <img src={schoolInfo.logo} alt="logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />}
      <div style={{ flex: 1 }}>
        <div style={{ color: c2, fontWeight: 900, fontSize: 15 }}>{schoolInfo.nom || "Ecole"}</div>
        <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Portail parent - {annee}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{utilisateur.nom}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
          <Badge color="teal">Parent</Badge>
          <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Deconnexion</button>
        </div>
      </div>
    </div>
  );
}
