import { useState, useEffect, useContext } from "react";
import { doc, onSnapshot, addDoc, collection } from "firebase/firestore";
import { db } from "../firebase";
import { SchoolContext } from "../App";
import { PLANS } from "../contexts/PlanContext";

const C = { blue: "#0A1628", green: "#00C48C", blueDark: "#0A1628" };

// Numéros de réception des paiements (à personnaliser)
const CONTACTS_PAIEMENT = [
  { operateur: "Orange Money", numero: "+224 627 738 579", couleur: "#ff6600" },
  { operateur: "MTN Mobile Money", numero: "+224 662 980 896", couleur: "#ffcc00" },
];

export default function UpgradeModal({ onFermer }) {
  const { schoolId, schoolInfo, setSchoolInfo } = useContext(SchoolContext);
  const [etape, setEtape] = useState("choix"); // choix | instructions | soumission | attente | succes
  const [form, setForm] = useState({
    telephone: "", operateur: "Orange Money", reference: "", montant: "",
  });
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");

  const chg = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  // Écoute temps réel : plan activé par le SuperAdmin
  useEffect(() => {
    if (etape !== "attente") return;
    const unsub = onSnapshot(doc(db, "ecoles", schoolId), snap => {
      if (snap.exists() && snap.data().plan === "pro") {
        setSchoolInfo(prev => ({
          ...prev, plan: "pro", planExpiry: snap.data().planExpiry,
        }));
        setEtape("succes");
      }
    });
    return () => unsub();
  }, [etape, schoolId]);

  const soumettreDemande = async () => {
    if (!form.telephone.trim()) { setErreur("Entrez votre numéro de téléphone."); return; }
    if (!form.reference.trim()) { setErreur("Entrez la référence/code de votre transaction."); return; }
    setChargement(true); setErreur("");
    try {
      await addDoc(collection(db, "ecoles", schoolId, "demandes_plan"), {
        telephone: form.telephone.trim(),
        operateur: form.operateur,
        reference: form.reference.trim(),
        montant: PLANS.pro.prix,
        statut: "en_attente",
        ecoleNom: schoolInfo?.nom || schoolId,
        schoolId,
        createdAt: Date.now(),
      });
      setEtape("attente");
    } catch (e) {
      setErreur("Erreur lors de la soumission. Réessayez.");
    } finally {
      setChargement(false);
    }
  };

  const S = {
    overlay: {
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI',system-ui,sans-serif", padding: 16,
    },
    modal: {
      background: "#fff", borderRadius: 18, padding: "32px 36px",
      width: "100%", maxWidth: 500, boxShadow: "0 24px 70px rgba(0,0,0,0.3)",
      maxHeight: "90vh", overflowY: "auto",
    },
    inp: {
      width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9,
      padding: "10px 14px", fontSize: 14, outline: "none", boxSizing: "border-box",
    },
    lbl: {
      display: "block", fontSize: 11, fontWeight: 700, color: C.blue,
      textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, marginTop: 14,
    },
    btn: (bg, color) => ({
      width: "100%", background: bg || `linear-gradient(90deg,${C.blue},${C.green})`,
      color: color || "#fff", border: "none", padding: "13px", borderRadius: 10,
      fontSize: 14, fontWeight: 800, cursor: "pointer", marginTop: 10,
    }),
    contact: (color) => ({
      background: color + "18", border: `1.5px solid ${color}44`,
      borderRadius: 12, padding: "14px 18px", marginBottom: 10,
    }),
  };

  return (
    <div style={S.overlay} onClick={onFermer}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>

        {/* ── ÉTAPE 1 : Choix du plan ── */}
        {etape === "choix" && (
          <>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>⭐</div>
              <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 900, color: C.blueDark }}>
                Passer en Plan Pro
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                Débloquez toutes les fonctionnalités pour <strong>{schoolInfo?.nom}</strong>
              </p>
            </div>

            {/* Comparaison plans */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              {["gratuit", "pro"].map(p => (
                <div key={p} style={{
                  borderRadius: 12, padding: "16px 14px",
                  border: `2px solid ${p === "pro" ? C.blue : "#e5e7eb"}`,
                  background: p === "pro" ? "#f0f6ff" : "#f9fafb",
                }}>
                  <p style={{ margin: "0 0 6px", fontWeight: 800, fontSize: 13, color: p === "pro" ? C.blue : "#6b7280" }}>
                    {p === "pro" ? "⭐ Pro" : "Gratuit"}
                  </p>
                  <p style={{ margin: "0 0 10px", fontWeight: 900, fontSize: 15, color: C.blueDark }}>
                    {p === "pro" ? "500 000 GNF/an" : "0 GNF"}
                  </p>
                  {PLANS[p].features.map(f => (
                    <p key={f} style={{ margin: "4px 0", fontSize: 11, color: "#374151" }}>
                      {p === "pro" ? "✅" : "▪"} {f}
                    </p>
                  ))}
                </div>
              ))}
            </div>

            <button onClick={() => setEtape("instructions")} style={S.btn()}>
              Souscrire au Plan Pro →
            </button>
            <button onClick={onFermer} style={S.btn("#f3f4f6", "#6b7280")}>
              Annuler
            </button>
          </>
        )}

        {/* ── ÉTAPE 2 : Instructions de paiement ── */}
        {etape === "instructions" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: C.blueDark }}>
              💳 Comment payer
            </h2>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
              Envoyez <strong>500 000 GNF</strong> via Mobile Money à l'un de ces numéros, puis soumettez votre référence de paiement.
            </p>

            {CONTACTS_PAIEMENT.map(c => (
              <div key={c.operateur} style={S.contact(c.couleur)}>
                <p style={{ margin: "0 0 4px", fontWeight: 800, fontSize: 14, color: "#1e293b" }}>
                  {c.operateur}
                </p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 900, letterSpacing: "0.05em", color: c.couleur === "#ffcc00" ? "#a16207" : c.couleur }}>
                  {c.numero}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#6b7280" }}>
                  Nom : <strong>Groupe Scolaire La Citadelle</strong>
                </p>
              </div>
            ))}

            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginTop: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#166534", lineHeight: 1.6 }}>
                ℹ️ Après votre paiement, conservez le <strong>code de confirmation</strong> ou la <strong>référence de transaction</strong> envoyé par l'opérateur. Vous en aurez besoin à l'étape suivante.
              </p>
            </div>

            <button onClick={() => setEtape("soumission")} style={{ ...S.btn(), marginTop: 20 }}>
              J'ai payé → Soumettre ma référence
            </button>
            <button onClick={() => setEtape("choix")} style={S.btn("#f3f4f6", "#6b7280")}>
              ← Retour
            </button>
          </>
        )}

        {/* ── ÉTAPE 3 : Soumission de la référence ── */}
        {etape === "soumission" && (
          <>
            <h2 style={{ margin: "0 0 6px", fontSize: 18, fontWeight: 900, color: C.blueDark }}>
              📋 Confirmer votre paiement
            </h2>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "#6b7280" }}>
              Renseignez les informations de votre paiement. Notre équipe vérifiera et activera votre plan dans les 24h.
            </p>

            <label style={S.lbl}>Opérateur utilisé</label>
            <div style={{ display: "flex", gap: 10 }}>
              {CONTACTS_PAIEMENT.map(c => (
                <button key={c.operateur} onClick={() => setForm(p => ({ ...p, operateur: c.operateur }))}
                  style={{
                    flex: 1, padding: "10px 8px", borderRadius: 9, cursor: "pointer",
                    fontWeight: 700, fontSize: 12,
                    border: `2px solid ${form.operateur === c.operateur ? c.couleur : "#e5e7eb"}`,
                    background: form.operateur === c.operateur ? c.couleur + "22" : "#fff",
                    color: form.operateur === c.operateur
                      ? (c.couleur === "#ffcc00" ? "#a16207" : c.couleur)
                      : "#6b7280",
                  }}>
                  {c.operateur}
                </button>
              ))}
            </div>

            <label style={S.lbl}>Votre numéro de téléphone *</label>
            <input style={S.inp} value={form.telephone}
              onChange={chg("telephone")} placeholder="Ex. : 622 000 000" type="tel"/>

            <label style={S.lbl}>Référence / Code de transaction *</label>
            <input style={S.inp} value={form.reference}
              onChange={chg("reference")}
              placeholder="Ex. : MP241015.1234.A56789"/>

            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", marginTop: 12 }}>
              <p style={{ margin: 0, fontSize: 12, color: "#92400e" }}>
                ⚠️ Assurez-vous d'avoir envoyé <strong>500 000 GNF</strong> avant de soumettre.
              </p>
            </div>

            {erreur && (
              <div style={{ background: "#fee2e2", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#991b1b", marginTop: 12 }}>
                {erreur}
              </div>
            )}

            <button onClick={soumettreDemande} disabled={chargement} style={{ ...S.btn(), opacity: chargement ? 0.7 : 1 }}>
              {chargement ? "Envoi en cours…" : "✅ Soumettre ma demande"}
            </button>
            <button onClick={() => setEtape("instructions")} style={S.btn("#f3f4f6", "#6b7280")}>
              ← Retour
            </button>
          </>
        )}

        {/* ── ÉTAPE 4 : En attente de validation ── */}
        {etape === "attente" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <h3 style={{ margin: "0 0 10px", color: C.blueDark }}>Demande envoyée !</h3>
            <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.7, marginBottom: 20 }}>
              Votre demande a été transmise à notre équipe.<br/>
              Le plan Pro sera activé <strong>sous 24h</strong> après vérification.<br/>
              Cette page se mettra à jour automatiquement.
            </p>
            <div style={{ background: "#f0f6ff", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: C.blue, marginBottom: 20 }}>
              📞 Pour toute urgence : contactez-nous directement via WhatsApp.
            </div>
            <button onClick={onFermer}
              style={{ background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "9px 24px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
              Fermer
            </button>
          </div>
        )}

        {/* ── ÉTAPE 5 : Succès (plan activé) ── */}
        {etape === "succes" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
            <h3 style={{ margin: "0 0 8px", color: "#065f46", fontSize: 20 }}>Plan Pro activé !</h3>
            <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
              Toutes les fonctionnalités sont maintenant débloquées pour <strong>{schoolInfo?.nom}</strong>.
            </p>
            <button onClick={onFermer} style={S.btn()}>
              Commencer à utiliser le Plan Pro →
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
