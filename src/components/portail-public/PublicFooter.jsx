// Pied de page du portail public.
export function PublicFooter({ schoolInfo, c2 }) {
  return (
    <div style={{ background: "#020c1b", padding: "20px 24px", textAlign: "center" }}>
      <p style={{ margin: 0, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
        {schoolInfo.nom} · Propulsé par <strong style={{ color: c2 }}>EduGest</strong> · {new Date().getFullYear()}
      </p>
    </div>
  );
}
