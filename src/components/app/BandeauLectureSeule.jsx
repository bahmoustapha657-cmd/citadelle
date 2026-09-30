import { useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { MSG_LECTURE_SEULE_PORTAIL } from "./app-shell-plan";

// ══════════════════════════════════════════════════════════════
//  Bandeau « consultation seule » des portails enseignant et parent
// ══════════════════════════════════════════════════════════════
// Abonnement de l'école expiré (après la grâce) : la base refuse toute
// écriture (supabase/ecole-hors-service.sql). Le bandeau le dit d'emblée,
// plutôt qu'au premier enregistrement refusé.
export function BandeauLectureSeule() {
  const { planInfo } = useContext(SchoolContext);
  if (!planInfo?.planEstExpire) return null;
  return (
    <div role="status" style={{ background: "#fee2e2", borderBottom: "1px solid #fca5a5", color: "#991b1b", padding: "8px 16px", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ fontSize: 15 }}>🔒</span>
      <span style={{ flex: 1, minWidth: 0 }}>{MSG_LECTURE_SEULE_PORTAIL}</span>
    </div>
  );
}
