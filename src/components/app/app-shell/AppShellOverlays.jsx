import { Suspense } from "react";
import { MessagesEcole } from "../lazy-pages";
import { OnboardingModal } from "../OnboardingModal";
import { RaccourcisModal } from "../RaccourcisModal";

// Éléments flottants superposés au shell : bouton + modale d'onboarding,
// capteur de clic pour fermer les dropdowns, modale de raccourcis et
// messages SuperAdmin de l'école.
export function AppShellOverlays({ p }) {
  return (
    <>
      {/* ── Bouton flottant guide de demarrage ── */}
      {p.estAdmin && (
        <button onClick={() => p.setOnboardingOuvert(true)}
          title="Guide de démarrage"
          style={{ position: "fixed", bottom: 24, insetInlineStart: p.isMobile ? 16 : 244, zIndex: 200, width: 44, height: 44, borderRadius: "50%", background: p.couleur2, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>
          🚀
        </button>
      )}

      {p.onboardingOuvert && (
        <OnboardingModal schoolInfo={p.schoolInfo} setPage={p.setPage} onClose={() => p.setOnboardingOuvert(false)} />
      )}

      {/* ── Fermer dropdowns au clic exterieur ── */}
      {(p.notifOuvert || p.profilOuvert) && (
        <div style={{ position: "fixed", inset: 0, zIndex: 150 }} onClick={() => { p.setNotifOuvert(false); p.setProfilOuvert(false); }} />
      )}

      {p.aideOuverte && <RaccourcisModal onClose={() => p.setAideOuverte(false)} />}

      {p.schoolId && p.schoolId !== "superadmin" && (
        <Suspense fallback={null}>
          <MessagesEcole utilisateur={p.utilisateur} schoolId={p.schoolId} />
        </Suspense>
      )}
    </>
  );
}
