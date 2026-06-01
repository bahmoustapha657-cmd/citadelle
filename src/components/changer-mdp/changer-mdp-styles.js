export const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(10,22,40,0.75)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

export const card = {
  background: "#fff",
  borderRadius: 16,
  padding: 40,
  maxWidth: 420,
  width: "90%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.3)",
  fontFamily: "'Segoe UI',system-ui,sans-serif",
};

export const label = { display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600, color: "#374151" };

export const input = {
  width: "100%",
  padding: "10px 12px",
  border: "1.5px solid #d1d5db",
  borderRadius: 8,
  fontSize: 14,
  boxSizing: "border-box",
  marginBottom: 14,
  outline: "none",
};

export const erreur = {
  color: "#dc2626",
  fontSize: 13,
  margin: "0 0 14px",
  background: "#fef2f2",
  padding: "8px 12px",
  borderRadius: 6,
};

export const submit = (busy) => ({
  width: "100%",
  background: "#0A1628",
  color: "#fff",
  border: "none",
  padding: "12px",
  borderRadius: 8,
  fontSize: 15,
  fontWeight: 700,
  cursor: "pointer",
  opacity: busy ? 0.7 : 1,
});
