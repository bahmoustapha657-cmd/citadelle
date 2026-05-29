import { Badge, Card, TR, TD } from "../../ui";
import { paiements, parentFeed } from "../demo-data";
import { TableCard } from "./TableCard";

// Démo onglet Portail parent : fil d'actualité + situation des paiements.
export function ParentsView() {
  return (
    <div style={{ display: "grid", gap: 18 }}>
      <Card style={{ padding: 18 }}>
        <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--lc-text-brand, #0A1628)" }}>Portail parent — Mme Camara (mère de Fatou)</h3>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--lc-text-muted, #64748b)" }}>
          Un parent voit les bulletins, les paiements, les absences et les messages de l'école dans un seul espace.
          Connexion par code école + numéro de téléphone parent.
        </p>
        <div style={{ display: "grid", gap: 10 }}>
          {parentFeed.map((item) => (
            <div key={item.titre} style={{ border: "1px solid var(--lc-border, #e2e8f0)", borderRadius: 12, padding: "12px 14px", background: "var(--lc-surface-alt, #f8fafc)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ color: "var(--lc-text-brand, #0A1628)", fontSize: 14 }}>{item.titre}</strong>
                <Badge color="blue">Lecture seule</Badge>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--lc-text-muted, #475569)", lineHeight: 1.6 }}>{item.detail}</p>
            </div>
          ))}
        </div>
      </Card>
      <TableCard
        title="Paiements et situation des élèves"
        subtitle="Exemple d'aperçu parent/comptabilité sur la même école."
        header={["Élève", "Classe", "Montant du mois", "Statut"]}
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
