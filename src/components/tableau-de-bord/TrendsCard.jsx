import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getAnnee } from "../../constants";
import { Card } from "../ui";

export function TrendsCard({ c1, c2, annee, dataTendance }) {
  return (
    <Card style={{ marginBottom: 16 }}><div style={{ padding: "16px 18px" }}>
      <p style={{ margin: "0 0 14px", fontWeight: 800, fontSize: 13, color: c1 }}>Tendances annuelles — {annee || getAnnee()}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Courbe taux paiement */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Taux de paiement (%)</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dataTendance} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Line type="monotone" dataKey="taux" stroke={c2} strokeWidth={2.5} dot={{ r: 3, fill: c2 }} name="Taux paiement" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {/* Courbe absences */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Absences enregistrées</p>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={dataTendance} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="absences" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3, fill: "#ef4444" }} name="Absences" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div></Card>
  );
}
