export const C = { blue: "#0A1628", green: "#00C48C", blueDark: "#0A1628" };

// Numéros de réception des paiements (à personnaliser)
export const CONTACTS_PAIEMENT = [
  { operateur: "Orange Money", numero: "+224 627 738 579", couleur: "#ff6600" },
  { operateur: "MTN Mobile Money", numero: "+224 662 980 896", couleur: "#ffcc00" },
];

export const S = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
    zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 16,
  },
  modal: {
    background: "#fff", borderRadius: 18, padding: "32px 36px",
    width: "100%", maxWidth: 500, boxShadow: "0 24px 70px rgba(0,0,0,0.3)",
    maxHeight: "90vh", overflowY: "auto",
  },
  inp: {
    width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9,
    padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box",
  },
  lbl: {
    display: "block", fontSize: 11, fontWeight: 700, color: C.blue,
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, marginTop: 14,
  },
  btn: (bg, color) => ({
    width: "100%", background: bg || `linear-gradient(90deg,${C.blue},${C.green})`,
    color: color || "#fff", border: "none", padding: "13px", borderRadius: 10,
    fontSize: 14, fontWeight: 800, cursor: "pointer", marginTop: 10,
  }),
  contact: (color) => ({
    background: color + "18", border: `1.5px solid ${color}44`,
    borderRadius: 12, padding: "14px 18px", marginBottom: 10,
  }),
};
