import { useState } from "react";
import { apiFetch } from "./apiClient";

export default function Inscription() {
  const [etape, setEtape] = useState(1); // 1=infos ecole, 2=compte admin, 3=succes
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [comptesInit, setComptesInit] = useState(null);
  const [form, setForm] = useState({
    nomEcole: "",
    ville: "",
    pays: "Guinee",
    adminLogin: "",
    adminMdp: "",
    adminMdp2: "",
  });

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const comptesSecondaires = comptesInit
    ? Object.values(comptesInit).filter((compte) => compte?.login && compte?.mdp)
    : [];

  const validerEtape1 = () => {
    if (!form.nomEcole.trim()) {
      setErreur("Le nom de l'ecole est requis.");
      return false;
    }
    if (!form.ville.trim()) {
      setErreur("La ville est requise.");
      return false;
    }
    setErreur("");
    return true;
  };

  const validerEtape2 = () => {
    if (!form.adminLogin.trim()) {
      setErreur("L'identifiant administrateur est requis.");
      return false;
    }
    if (form.adminMdp.length < 8) {
      setErreur("Le mot de passe doit contenir au moins 8 caracteres.");
      return false;
    }
    if (form.adminMdp !== form.adminMdp2) {
      setErreur("Les mots de passe ne correspondent pas.");
      return false;
    }
    setErreur("");
    return true;
  };

  const inscrire = async () => {
    if (!validerEtape2()) return;
    setChargement(true);
    setErreur("");
    try {
      const r = await apiFetch("/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomEcole: form.nomEcole,
          ville: form.ville,
          pays: form.pays,
          adminLogin: form.adminLogin,
          adminMdp: form.adminMdp,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErreur(data.error || "Erreur lors de l'inscription. Veuillez reessayer.");
        return;
      }
      localStorage.setItem("LC_schoolId", data.schoolId);
      localStorage.removeItem("LC_comptes_init");
      setComptesInit(data.compteSecondaires || null);
      setEtape(3);
    } catch (e) {
      console.error(e);
      setErreur("Impossible de joindre le serveur. Verifiez votre connexion.");
    } finally {
      setChargement(false);
    }
  };

  const cardStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Segoe UI',system-ui,sans-serif",
    background: "linear-gradient(135deg,#002050 0%,#0A1628 50%,#00A876 100%)",
  };
  const boxStyle = {
    background: "#fff",
    borderRadius: 18,
    padding: "36px 32px",
    width: "100%",
    maxWidth: 440,
    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  };
  const inputStyle = {
    width: "100%",
    border: "1px solid #b0c4d8",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 14,
    boxSizing: "border-box",
    outline: "none",
    marginTop: 4,
  };
  const labelStyle = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: "#0A1628",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginTop: 12,
  };
  const btnStyle = {
    width: "100%",
    background: "linear-gradient(90deg,#0A1628,#00C48C)",
    color: "#fff",
    border: "none",
    padding: 12,
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 16,
  };
  const errStyle = {
    background: "#fce8e8",
    border: "1px solid #f5c1c1",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    color: "#9b2020",
    textAlign: "center",
    marginTop: 12,
  };

  if (etape === 3) {
    return (
      <div style={cardStyle}>
        <div style={{ ...boxStyle, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>OK</div>
          <h2 style={{ color: "#0A1628", margin: "0 0 8px" }}>Ecole creee avec succes !</h2>
          <p style={{ color: "#555", fontSize: 14, marginBottom: 20 }}>
            Votre espace <strong>{form.nomEcole}</strong> est pret.
            <br />
            Connectez-vous avec vos identifiants administrateur.
          </p>
          <div style={{ background: "#f0f6f2", borderRadius: 10, padding: "14px 18px", textAlign: "left", fontSize: 13, marginBottom: 20 }}>
            <div style={{ marginBottom: 8 }}><strong>Votre compte Direction :</strong></div>
            <div style={{ fontFamily: "monospace", background: "#e0ebf8", borderRadius: 6, padding: "6px 10px", marginBottom: 12 }}>
              <div>Identifiant : <strong>{form.adminLogin}</strong></div>
              <div>Mot de passe : <strong>{form.adminMdp}</strong></div>
            </div>
            {comptesSecondaires.length > 0 && (
              <div>
                <div style={{ marginBottom: 6, fontWeight: 700, color: "#b45309" }}>
                  Attention : comptes complementaires a noter puis securiser apres connexion :
                </div>
                <div style={{ fontFamily: "monospace", background: "#fff7ed", borderRadius: 6, padding: "6px 10px" }}>
                  {comptesSecondaires.map((compte) => (
                    <div key={compte.login}>{compte.login} / <strong>{compte.mdp}</strong></div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <a href="/" style={{ ...btnStyle, display: "block", textDecoration: "none", textAlign: "center" }}>
            Aller a la connexion
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: "#0A1628" }}>
            Creer votre espace ecole
          </h2>
          <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
            Systeme de gestion scolaire - EduGest
          </p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
            {[1, 2].map((n) => (
              <div
                key={n}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  background: etape >= n ? "#0A1628" : "#e0ebf8",
                  color: etape >= n ? "#fff" : "#0A1628",
                }}
              >
                {n}
              </div>
            ))}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "#6b7280" }}>
            {etape === 1 ? "Informations de l'ecole" : "Compte administrateur"}
          </p>
        </div>

        {etape === 1 && (
          <>
            <label style={labelStyle}>Nom de l'ecole *</label>
            <input
              style={inputStyle}
              value={form.nomEcole}
              onChange={chg("nomEcole")}
              placeholder="Ex. : Ecole La Citadelle"
              autoFocus
            />

            <label style={labelStyle}>Ville *</label>
            <input
              style={inputStyle}
              value={form.ville}
              onChange={chg("ville")}
              placeholder="Ex. : Kindia"
            />

            <label style={labelStyle}>Pays</label>
            <input
              style={inputStyle}
              value={form.pays}
              onChange={chg("pays")}
              placeholder="Ex. : Guinee"
            />

            {erreur && <div style={errStyle}>{erreur}</div>}

            <button style={btnStyle} onClick={() => { if (validerEtape1()) setEtape(2); }}>
              Suivant -&gt;
            </button>
          </>
        )}

        {etape === 2 && (
          <>
            <label style={labelStyle}>Identifiant de connexion *</label>
            <input
              style={inputStyle}
              value={form.adminLogin}
              onChange={chg("adminLogin")}
              placeholder="Ex. : directeur"
              autoFocus
            />

            <label style={labelStyle}>Mot de passe *</label>
            <input
              style={inputStyle}
              type="password"
              value={form.adminMdp}
              onChange={chg("adminMdp")}
              placeholder="Minimum 8 caracteres"
            />

            <label style={labelStyle}>Confirmer le mot de passe *</label>
            <input
              style={inputStyle}
              type="password"
              value={form.adminMdp2}
              onChange={chg("adminMdp2")}
              placeholder="Repetez le mot de passe"
            />

            {erreur && <div style={errStyle}>{erreur}</div>}

            <button style={btnStyle} onClick={inscrire} disabled={chargement}>
              {chargement ? "Creation en cours..." : "Creer mon ecole"}
            </button>

            <button
              onClick={() => { setEtape(1); setErreur(""); }}
              style={{
                width: "100%",
                background: "none",
                border: "1px solid #b0c4d8",
                borderRadius: 9,
                padding: "10px",
                fontSize: 13,
                cursor: "pointer",
                color: "#0A1628",
                marginTop: 8,
              }}
            >
              &lt;- Retour
            </button>
          </>
        )}

        <p style={{ textAlign: "center", marginTop: 18, fontSize: 12, color: "#9ca3af" }}>
          Deja inscrit ?{" "}
          <a href="/" style={{ color: "#0A1628", fontWeight: 700, textDecoration: "none" }}>
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
