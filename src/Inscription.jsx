import { useState } from "react";
import { db } from "./firebase";
import { doc, setDoc, collection, addDoc } from "firebase/firestore";
import bcrypt from "bcryptjs";

export default function Inscription() {
  const [etape, setEtape] = useState(1); // 1=infos école, 2=compte admin, 3=succès
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [form, setForm] = useState({
    nomEcole: "", ville: "", pays: "Guinée",
    adminLogin: "", adminMdp: "", adminMdp2: "",
  });

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Génère un ID école à partir du nom (slug simple)
  const genSlug = (nom) =>
    nom.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) || "ecole";

  const validerEtape1 = () => {
    if (!form.nomEcole.trim()) { setErreur("Le nom de l'école est requis."); return false; }
    if (!form.ville.trim())    { setErreur("La ville est requise."); return false; }
    setErreur(""); return true;
  };

  const validerEtape2 = () => {
    if (!form.adminLogin.trim()) { setErreur("L'identifiant administrateur est requis."); return false; }
    if (form.adminMdp.length < 6) { setErreur("Le mot de passe doit contenir au moins 6 caractères."); return false; }
    if (form.adminMdp !== form.adminMdp2) { setErreur("Les mots de passe ne correspondent pas."); return false; }
    setErreur(""); return true;
  };

  const inscrire = async () => {
    if (!validerEtape2()) return;
    setChargement(true);
    setErreur("");
    try {
      const schoolId = genSlug(form.nomEcole);
      const mdpHash = await bcrypt.hash(form.adminMdp, 10);

      // Créer le document école
      await setDoc(doc(db, "ecoles", schoolId), {
        nom: form.nomEcole.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        createdAt: Date.now(),
        actif: true,
      });

      // Créer les comptes par défaut sous /ecoles/{schoolId}/comptes/
      const comptes = [
        { login: form.adminLogin.trim(), mdp: mdpHash, role: "direction", label: "Direction", statut: "Actif" },
        { login: "comptable",  mdp: await bcrypt.hash("compta123",  10), role: "comptable",  label: "Comptable",  statut: "Actif" },
        { login: "admin",      mdp: await bcrypt.hash("admin123",   10), role: "admin",      label: "Admin",      statut: "Actif" },
      ];
      for (const c of comptes) {
        await addDoc(collection(db, "ecoles", schoolId, "comptes"), c);
      }

      setEtape(3);
      // Stocker l'ID école pour un futur login automatique (optionnel)
      localStorage.setItem("LC_schoolId", schoolId);
    } catch (e) {
      console.error(e);
      setErreur("Erreur lors de l'inscription : " + (e.message || "Veuillez réessayer."));
    } finally {
      setChargement(false);
    }
  };

  // ── Styles communs ──
  const cardStyle = {
    minHeight: "100vh", display: "flex", alignItems: "center",
    justifyContent: "center", fontFamily: "'Segoe UI',system-ui,sans-serif",
    background: "linear-gradient(135deg,#002050 0%,#003d7a 50%,#1a7d40 100%)",
  };
  const boxStyle = {
    background: "#fff", borderRadius: 18, padding: "36px 32px",
    width: "100%", maxWidth: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  };
  const inputStyle = {
    width: "100%", border: "1px solid #b0c4d8", borderRadius: 8,
    padding: "10px 12px", fontSize: 14, boxSizing: "border-box",
    outline: "none", marginTop: 4,
  };
  const labelStyle = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#003d7a",
    textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 12,
  };
  const btnStyle = {
    width: "100%", background: "linear-gradient(90deg,#003d7a,#2eb55f)",
    color: "#fff", border: "none", padding: 12, borderRadius: 9,
    fontSize: 14, fontWeight: 800, cursor: "pointer", marginTop: 16,
  };
  const errStyle = {
    background: "#fce8e8", border: "1px solid #f5c1c1", borderRadius: 8,
    padding: "9px 12px", fontSize: 13, color: "#9b2020",
    textAlign: "center", marginTop: 12,
  };

  // ── Étape 3 : Succès ──
  if (etape === 3) {
    return (
      <div style={cardStyle}>
        <div style={{ ...boxStyle, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
          <h2 style={{ color: "#003d7a", margin: "0 0 8px" }}>École créée avec succès !</h2>
          <p style={{ color: "#555", fontSize: 14, marginBottom: 20 }}>
            Votre espace <strong>{form.nomEcole}</strong> est prêt.<br />
            Connectez-vous avec vos identifiants administrateur.
          </p>
          <div style={{ background: "#f0f6f2", borderRadius: 10, padding: "14px 18px", textAlign: "left", fontSize: 13, marginBottom: 20 }}>
            <div><strong>Identifiant :</strong> {form.adminLogin}</div>
            <div><strong>Rôle :</strong> Direction</div>
            <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
              Comptes supplémentaires créés : comptable / compta123 · admin / admin123<br />
              <strong>Changez ces mots de passe dès la première connexion.</strong>
            </div>
          </div>
          <a href="/" style={{ ...btnStyle, display: "block", textDecoration: "none", textAlign: "center" }}>
            Aller à la connexion
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        {/* En-tête */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#003d7a" }}>
            Créer votre espace école
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
            Système de gestion scolaire · La Citadelle
          </p>
          {/* Indicateur d'étape */}
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            {[1, 2].map((n) => (
              <div key={n} style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex",
                alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                background: etape >= n ? "#003d7a" : "#e0ebf8",
                color: etape >= n ? "#fff" : "#003d7a",
              }}>{n}</div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280" }}>
            {etape === 1 ? "Informations de l'école" : "Compte administrateur"}
          </p>
        </div>

        {/* Étape 1 */}
        {etape === 1 && (
          <>
            <label style={labelStyle}>Nom de l'école *</label>
            <input style={inputStyle} value={form.nomEcole} onChange={chg("nomEcole")}
              placeholder="Ex. : École La Citadelle" autoFocus />

            <label style={labelStyle}>Ville *</label>
            <input style={inputStyle} value={form.ville} onChange={chg("ville")}
              placeholder="Ex. : Kindia" />

            <label style={labelStyle}>Pays</label>
            <input style={inputStyle} value={form.pays} onChange={chg("pays")}
              placeholder="Ex. : Guinée" />

            {erreur && <div style={errStyle}>{erreur}</div>}

            <button style={btnStyle} onClick={() => { if (validerEtape1()) setEtape(2); }}>
              Suivant →
            </button>
          </>
        )}

        {/* Étape 2 */}
        {etape === 2 && (
          <>
            <label style={labelStyle}>Identifiant de connexion *</label>
            <input style={inputStyle} value={form.adminLogin} onChange={chg("adminLogin")}
              placeholder="Ex. : directeur" autoFocus />

            <label style={labelStyle}>Mot de passe *</label>
            <input style={inputStyle} type="password" value={form.adminMdp}
              onChange={chg("adminMdp")} placeholder="Minimum 6 caractères" />

            <label style={labelStyle}>Confirmer le mot de passe *</label>
            <input style={inputStyle} type="password" value={form.adminMdp2}
              onChange={chg("adminMdp2")} placeholder="Répétez le mot de passe" />

            {erreur && <div style={errStyle}>{erreur}</div>}

            <button style={btnStyle} onClick={inscrire} disabled={chargement}>
              {chargement ? "Création en cours…" : "Créer mon école"}
            </button>

            <button onClick={() => { setEtape(1); setErreur(""); }}
              style={{ width: "100%", background: "none", border: "1px solid #b0c4d8",
                borderRadius: 9, padding: "10px", fontSize: 13, cursor: "pointer",
                color: "#003d7a", marginTop: 8 }}>
              ← Retour
            </button>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9ca3af" }}>
          Déjà inscrit ?{" "}
          <a href="/" style={{ color: "#003d7a", fontWeight: 700, textDecoration: "none" }}>
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
