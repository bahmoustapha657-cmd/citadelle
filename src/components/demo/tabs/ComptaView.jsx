import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, TR, TD } from "../../ui";
import { evolPaiements, salaires } from "../demo-data";
import { TableCard } from "./TableCard";

// Démo onglet Comptabilité : graphe recettes/dépenses + état des salaires.
export function ComptaView() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, color: "var(--lc-text-brand, #0A1628)" }}>Évolution recettes vs dépenses (en M GNF)</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={evolPaiements}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8" />
            <XAxis dataKey="mois" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}M`} />
            <Tooltip formatter={(v) => `${v} M GNF`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="revenus" name="Recettes" fill="#00C48C" radius={[4, 4, 0, 0]} />
            <Bar dataKey="depenses" name="Dépenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <TableCard
        title="État des salaires — mai 2026 (extrait)"
        subtitle="Calcul automatique : forfait ou volume horaire × prime, déduction des bons, ajout des révisions."
        header={["Nom", "Fonction", "Montant brut", "Bon", "Net à payer"]}
        rows={salaires.map((item) => (
          <TR key={item.nom}>
            <TD bold>{item.nom}</TD>
            <TD>{item.role}</TD>
            <TD>{item.montant} GNF</TD>
            <TD style={{ color: Number(item.bon.replace(/\s/g, "")) > 0 ? "#b91c1c" : "var(--lc-text-faint, #94a3b8)" }}>{item.bon} GNF</TD>
            <TD style={{ color: "#0f766e", fontWeight: 700 }}>{item.net} GNF</TD>
          </TR>
        ))}
      />
    </div>
  );
}
