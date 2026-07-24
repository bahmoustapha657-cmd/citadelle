import { useState, useContext } from "react";
import { C } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { sauverParametresEcole } from "../../backend/data-supabase";

// Réglages des notifications parents (SMS / WhatsApp) — écrit dans
// ecoles.extra.notifications. Chaque déclencheur est opt-in (désactivé par
// défaut). Tant qu'aucun fournisseur n'est configuré côté serveur (secrets
// Edge Function `notify`), ces réglages n'ont aucun effet — un bandeau le
// signale. Onglet autonome : sauvegarde directe, indépendante du form global.
const PLAN_COULEUR = "#f59e0b"; // couleur du plan Premium (cf. PLANS)
const PLAN_BG = "#fef3c7";

const DECLENCHEURS = [
  { cle: "paiement", label: "Paiements", desc: "Reçu envoyé au tuteur quand une mensualité est encaissée." },
  { cle: "absence", label: "Absences / retards", desc: "Alerte le jour où l'élève est noté absent ou en retard." },
  { cle: "annonce", label: "Annonces", desc: "Diffusion d'une annonce à tous les tuteurs joignables." },
];

export function NotificationsTab({ schoolId, schoolInfo, toast, sec, lbl }) {
  const { planInfo } = useContext(SchoolContext);
  const estPremium = !!planInfo?.estPremium;
  const init = schoolInfo?.notifications || {};
  const [prefs, setPrefs] = useState({
    paiement: !!init.paiement, absence: !!init.absence, annonce: !!init.annonce,
    heureDebut: Number.isFinite(init.heureDebut) ? init.heureDebut : 7,
    heureFin: Number.isFinite(init.heureFin) ? init.heureFin : 20,
  });
  const [enCours, setEnCours] = useState(false);

  const toggle = (cle) => setPrefs((p) => ({ ...p, [cle]: !p[cle] }));

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await sauverParametresEcole(schoolId, { notifications: prefs });
      toast("Réglages de notification enregistrés.", "success");
    } catch (e) {
      toast(e.message || "Enregistrement impossible.", "error");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={sec}>
      {estPremium ? (
        <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12.5, color: "#92400e" }}>
          ⓘ L'envoi réel (SMS / WhatsApp) nécessite la configuration d'un fournisseur par l'administrateur EduGest.
          Tant que ce n'est pas fait, ces réglages sont enregistrés mais aucun message n'est envoyé.
        </div>
      ) : (
        <div style={{ background: PLAN_BG, border: `1px solid ${PLAN_COULEUR}`, borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#78350f" }}>
          <strong>🔒 Fonctionnalité Premium.</strong> Les notifications SMS / WhatsApp aux tuteurs
          sont incluses dans le plan <strong>Premium</strong> (chaque message envoyé est facturé).
          Votre plan actuel : <strong>{planInfo?.planLabel || "Gratuit"}</strong>.
          Contactez EduGest pour passer au Premium et activer ces alertes.
        </div>
      )}

      {DECLENCHEURS.map((d) => (
        <label key={d.cle} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--lc-border)", cursor: estPremium ? "pointer" : "not-allowed", opacity: estPremium ? 1 : 0.55 }}>
          <input type="checkbox" checked={prefs[d.cle]} disabled={!estPremium} onChange={() => toggle(d.cle)} style={{ marginTop: 3, width: 18, height: 18, cursor: estPremium ? "pointer" : "not-allowed" }} />
          <span>
            <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--lc-text)" }}>{d.label}</span>
            <span style={{ display: "block", fontSize: 12, color: "var(--lc-text-muted)", marginTop: 2 }}>{d.desc}</span>
          </span>
        </label>
      ))}

      <div style={{ display: "flex", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
        <div>
          <span style={lbl}>Pas d'envoi avant (heure)</span>
          <input type="number" min={0} max={23} value={prefs.heureDebut}
            onChange={(e) => setPrefs((p) => ({ ...p, heureDebut: Math.max(0, Math.min(23, Number(e.target.value))) }))}
            style={{ width: 90, border: "1px solid var(--lc-border)", borderRadius: 8, padding: "9px 12px", fontSize: 13 }} />
        </div>
        <div>
          <span style={lbl}>Pas d'envoi après (heure)</span>
          <input type="number" min={0} max={23} value={prefs.heureFin}
            onChange={(e) => setPrefs((p) => ({ ...p, heureFin: Math.max(0, Math.min(23, Number(e.target.value))) }))}
            style={{ width: 90, border: "1px solid var(--lc-border)", borderRadius: 8, padding: "9px 12px", fontSize: 13 }} />
        </div>
      </div>
      <p style={{ fontSize: 11.5, color: "var(--lc-text-muted)", marginTop: 6 }}>
        Fenêtre horaire (heure locale de Guinée) : aucun message n'est envoyé la nuit, hors de cette plage.
      </p>

      <button onClick={enregistrer} disabled={enCours || !estPremium}
        style={{ width: "100%", marginTop: 18, background: estPremium ? `linear-gradient(90deg,${C.blue},${C.green})` : "#cbd5e1", color: "#fff", border: "none", padding: "13px", borderRadius: 10, fontSize: 14, fontWeight: 800, cursor: estPremium ? "pointer" : "not-allowed", opacity: enCours ? 0.7 : 1 }}>
        {enCours ? "Enregistrement…" : estPremium ? "💾 Enregistrer les notifications" : "🔒 Réservé au plan Premium"}
      </button>
    </div>
  );
}
