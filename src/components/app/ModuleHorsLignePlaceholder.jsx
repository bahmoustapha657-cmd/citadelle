// ══════════════════════════════════════════════════════════════
//  État « module indisponible hors ligne » (mode hors ligne, vague 1)
// ══════════════════════════════════════════════════════════════
// Affiché à la place du module quand l'app est sans réseau et que la page
// courante n'est pas couverte par le miroir local PowerSync (Comptes & Postes,
// Comptabilité, Paramètres, Calendrier, Examens, Messages…). Évite d'ouvrir un
// écran qui enchaînerait des requêtes réseau vouées à l'échec, et propose de
// rejoindre un module académique utilisable hors ligne (Élèves / Notes).
import { MODULES } from "../../constants";
import { MODULES_HORS_LIGNE } from "../../backend/powersync/tables";

export function ModuleHorsLignePlaceholder({ page, modulesVisibles = [], setPage }) {
  const module = MODULES.find((m) => m.id === page);
  const academique = modulesVisibles.find((m) => MODULES_HORS_LIGNE.has(m.id));

  return (
    <div style={{ padding: "40px 24px", display: "flex", justifyContent: "center" }}>
      <div
        style={{
          width: "min(520px, 100%)",
          background: "var(--lc-card, #fff)",
          border: "1px solid var(--lc-border, #e5e7eb)",
          borderRadius: 18,
          padding: "32px 28px",
          textAlign: "center",
          boxShadow: "0 12px 32px rgba(0,0,0,0.08)",
        }}
      >
        <div style={{ fontSize: 46, lineHeight: 1, marginBottom: 14 }}>📴</div>
        <h2 style={{ margin: "0 0 8px", fontSize: 19, fontWeight: 800, color: "var(--lc-text, #0f172a)" }}>
          {module?.label || "Ce module"} — indisponible hors ligne
        </h2>
        <p style={{ margin: "0 0 22px", fontSize: 14, lineHeight: 1.55, color: "var(--lc-text-soft, #475569)" }}>
          Vous êtes actuellement <strong>sans connexion Internet</strong>. Ce module nécessite
          le réseau. Le mode hors ligne couvre les <strong>données scolaires</strong> (élèves,
          notes, absences) — reconnectez-vous pour accéder au reste.
        </p>
        {academique && (
          <button
            type="button"
            onClick={() => setPage(academique.id)}
            style={{
              background: "var(--lc-primary, #2563eb)",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "11px 20px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {academique.icon} Aller à « {academique.label} »
          </button>
        )}
      </div>
    </div>
  );
}
