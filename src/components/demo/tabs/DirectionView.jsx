import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Badge, Card, Stat, TR, TD } from "../../ui";
import { kpis, repartitionSections, evolPaiements, paiements } from "../demo-data";
import { TableCard } from "./TableCard";

// Démo vue direction (par défaut) : KPIs, graphes et paiements récents.
export function DirectionView() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        {kpis.map((item) => (
          <Stat key={item.label} label={item.label} value={item.value} sub={item.sub} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--lc-text-brand, #0A1628)" }}>Évolution mensuelle (M GNF)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={evolPaiements}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
              <XAxis dataKey="mois" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}M`} />
              <Tooltip />
              <Bar dataKey="revenus" name="Recettes" fill="#00C48C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card style={{ padding: 18 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, color: "var(--lc-text-brand, #0A1628)" }}>Répartition par section</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={repartitionSections} cx="50%" cy="50%" outerRadius={75} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {repartitionSections.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v} élèves`} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
      <TableCard
        title="Paiements récents"
        subtitle="Suivi en temps réel pour la direction et la comptabilité."
        header={["Élève", "Classe", "Montant", "Statut"]}
        rows={paiements.slice(0, 6).map((item) => (
          <TR key={item.eleve}>
            <TD bold>{item.eleve}</TD>
            <TD>{item.classe}</TD>
            <TD>{item.montant}</TD>
            <TD>
              <Badge color={item.statut === "À jour" ? "green" : item.statut === "Partiel" ? "amber" : "red"}>{item.statut}</Badge>
            </TD>
          </TR>
        ))}
      />
    </div>
  );
}
