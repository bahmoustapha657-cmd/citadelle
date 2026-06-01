import { C } from "../constants";
import { Btn, Modale, Selec } from "./ui";
import { useMigrationPeriodes } from "./migration-periodes/use-migration-periodes";

export function MigrationPeriodesModal({ fermer }) {
  const { periodesActuelles, chargement, orphelines, mapping, setMapping, enCours, lancer } =
    useMigrationPeriodes({ fermer });

  return (
    <Modale titre="🔁 Migration des notes — périodes orphelines" fermer={fermer}>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#475569" }}>
        Périodicité actuelle de l'école : <strong style={{ color: C.blue }}>{periodesActuelles.join(" · ")}</strong>
      </p>

      {chargement && <p style={{ fontSize: 12, color: "#64748b" }}>Analyse des notes en cours…</p>}

      {!chargement && orphelines.length === 0 && (
        <p style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 12, color: "#15803d" }}>
          ✅ Aucune note orpheline détectée. Toutes les notes utilisent une période valide pour la périodicité actuelle.
        </p>
      )}

      {!chargement && orphelines.length > 0 && (
        <>
          <p style={{ margin: "8px 0", fontSize: 12, color: "#92400e", padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6 }}>
            ⚠️ {orphelines.length} période(s) orpheline(s) détectée(s). Pour chacune, choisissez une période actuelle de destination ou la suppression.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {orphelines.map((o) => (
              <div key={o.periode} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.blueDark }}>{o.periode}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{o.count} note(s)</div>
                </div>
                <Selec
                  label="Migrer vers"
                  value={mapping[o.periode] || ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [o.periode]: e.target.value }))}
                >
                  {periodesActuelles.map((p) => <option key={p} value={p}>{p}</option>)}
                  <option value="_delete_">🗑️ Supprimer ces notes</option>
                </Selec>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Btn v="ghost" onClick={fermer} disabled={enCours}>Fermer</Btn>
        {orphelines.length > 0 && (
          <Btn v="success" onClick={lancer} disabled={enCours || chargement}>
            {enCours ? "Migration en cours…" : "Appliquer la migration"}
          </Btn>
        )}
      </div>
    </Modale>
  );
}
