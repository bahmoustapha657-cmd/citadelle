import { C } from "../../../constants";

// KPIs globaux : totaux d'écoles par statut.
export function EcolesStats({ ecoles, chargement }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 14, marginBottom: 24 }}>
      {[
        { label: "Ecoles totales", val: ecoles.length, icon: "EC", color: C.blue },
        { label: "Ecoles actives", val: ecoles.filter(e => e.actif && !e.supprime).length, icon: "ON", color: C.green },
        { label: "Ecoles inactives", val: ecoles.filter(e => !e.actif && !e.supprime).length, icon: "OFF", color: "#ef4444" },
        { label: "Ecoles supprimees", val: ecoles.filter(e => e.supprime).length, icon: "DEL", color: "#7f1d1d" },
      ].map(({ label, val, icon, color }) => (
        <div key={label} style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 12px rgba(0,32,80,0.07)", borderLeft: `4px solid ${color}` }}>
          <div style={{ fontSize: 22 }}>{icon}</div>
          <div style={{ fontSize: 24, fontWeight: 900, color, marginTop: 4 }}>{chargement ? "..." : val}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
