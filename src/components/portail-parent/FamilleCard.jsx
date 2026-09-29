import { fmt } from "../../constants";
import { Badge, Card } from "../ui";

// Vue « famille » d'un parent de plusieurs enfants (toutes classes et
// sections) : chaque enfant — classe, absences, messages non lus, reste à
// payer — et le total à payer pour toute la famille. Données :
// resumeFamille (portail-parent-derive.js). Un enfant se choisit d'un clic ;
// « Paiements » ouvre directement son détail.
export function FamilleCard({ famille, eleveId, onVoirEnfant, c1 }) {
  const { enfants, totalAPayer, aJour } = famille;
  return (
    <Card style={{ marginBottom: 20 }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong style={{ fontSize: 14, color: c1 }}>👪 Ma famille</strong>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {enfants.length} enfants · {aJour === enfants.length ? "tous à jour" : `${aJour} à jour sur ${enfants.length}`}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>Total à payer pour la famille</div>
          <div data-testid="total-famille" style={{ fontSize: 22, fontWeight: 900, color: totalAPayer > 0 ? "#b91c1c" : "#166534" }}>
            {totalAPayer > 0 ? fmt(totalAPayer) : "✅ À jour"}
          </div>
        </div>
      </div>

      {enfants.map((e) => {
        const courant = e.id === eleveId;
        return (
          <div key={e.id} data-testid="enfant-famille"
            style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: courant ? "#f8fbff" : "transparent" }}>
            <button type="button" onClick={() => onVoirEnfant(e.id)} title="Afficher cet enfant"
              style={{ flex: "1 1 180px", minWidth: 0, textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, color: "#0A1628" }}>
                {e.nom || "Élève"} {courant && <Badge color="blue">Affiché</Badge>}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                {[e.classe, e.parti && "a quitté l'établissement"].filter(Boolean).join(" · ") || "Classe non renseignée"}
              </div>
            </button>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Badge color={e.absences ? "red" : "gray"}>{e.absences} absence{e.absences > 1 ? "s" : ""}</Badge>
              {e.nonLus > 0 && <Badge color="amber">{e.nonLus} message{e.nonLus > 1 ? "s" : ""} non lu{e.nonLus > 1 ? "s" : ""}</Badge>}
              {e.bloque && <Badge color="red">🔒 Notes bloquées</Badge>}
            </div>
            <div style={{ minWidth: 110, textAlign: "right", marginLeft: "auto" }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: e.resteAPayer > 0 ? "#b91c1c" : "#166534" }}>
                {e.resteAPayer > 0 ? fmt(e.resteAPayer) : "À jour"}
              </div>
              <button type="button" onClick={() => onVoirEnfant(e.id, "paiements")}
                style={{ marginTop: 2, fontSize: 11.5, color: c1, background: "none", border: "none", padding: 0, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" }}>
                Paiements →
              </button>
            </div>
          </div>
        );
      })}

      <div style={{ padding: "10px 18px", fontSize: 11.5, color: "#94a3b8", lineHeight: 1.5 }}>
        Reste à payer sur l'année scolaire : mensualités, inscription et frais, dispenses déduites — le détail de chaque enfant est dans son onglet Paiements.
      </div>
    </Card>
  );
}
