import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebaseDb";
import { C, PLANS } from "../constants";

// Rôles ciblables — jamais "parent" ni "superadmin".
const ROLES_CIBLABLES = [
  { id: "direction", label: "Direction" },
  { id: "admin", label: "Admin" },
  { id: "comptable", label: "Comptabilité" },
  { id: "primaire", label: "Primaire" },
  { id: "college", label: "Collège / Lycée" },
  { id: "enseignant", label: "Enseignant" },
];

const NIVEAUX = [
  { id: "info", label: "Info", couleur: "#0369a1", bg: "#e0f2fe" },
  { id: "important", label: "Important", couleur: "#a16207", bg: "#fef3c7" },
  { id: "critique", label: "Critique", couleur: "#991b1b", bg: "#fee2e2" },
];

function CommunicationsAdmin({ ecoles = [], auteur = "superadmin" }) {
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [niveau, setNiveau] = useState("info");
  const [modeCible, setModeCible] = useState("toutes"); // toutes | plan | selection
  const [planChoisi, setPlanChoisi] = useState("gratuit");
  const [schoolsChoisies, setSchoolsChoisies] = useState([]);
  const [rolesChoisis, setRolesChoisis] = useState(["direction", "admin"]);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [succes, setSucces] = useState("");
  const [messages, setMessages] = useState([]);
  const [statsLectures, setStatsLectures] = useState({});

  useEffect(() => {
    const q = query(collection(db, "superadmin_messages"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const liste = snap.docs.map((d) => ({ ...d.data(), _id: d.id }));
      setMessages(liste);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;
    let annule = false;
    (async () => {
      const stats = {};
      await Promise.all(
        messages.map(async (m) => {
          try {
            const lectSnap = await getDocs(
              collection(db, "superadmin_messages", m._id, "lectures"),
            );
            const ecolesUniques = new Set();
            lectSnap.docs.forEach((d) => {
              const data = d.data();
              if (data?.schoolId) ecolesUniques.add(data.schoolId);
            });
            stats[m._id] = { lectures: lectSnap.size, ecoles: ecolesUniques.size };
          } catch {
            stats[m._id] = { lectures: 0, ecoles: 0 };
          }
        }),
      );
      if (!annule) setStatsLectures(stats);
    })();
    return () => {
      annule = true;
    };
  }, [messages]);

  const ecolesParPlan = useMemo(() => {
    const map = {};
    ecoles.forEach((e) => {
      const plan = e.plan || "gratuit";
      map[plan] = (map[plan] || 0) + 1;
    });
    return map;
  }, [ecoles]);

  const toggleRole = (id) => {
    setRolesChoisis((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const toggleSchool = (id) => {
    setSchoolsChoisies((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const reinitFormulaire = () => {
    setTitre("");
    setCorps("");
    setNiveau("info");
    setModeCible("toutes");
    setSchoolsChoisies([]);
    setRolesChoisis(["direction", "admin"]);
  };

  const construireCibleSchools = () => {
    if (modeCible === "toutes") return ["*"];
    if (modeCible === "plan") {
      return ecoles.filter((e) => (e.plan || "gratuit") === planChoisi).map((e) => e._id);
    }
    return schoolsChoisies;
  };

  const envoyer = async () => {
    setErreur("");
    if (!titre.trim() || titre.trim().length < 3) {
      setErreur("Le titre doit faire au moins 3 caractères.");
      return;
    }
    if (!corps.trim() || corps.trim().length < 5) {
      setErreur("Le message doit faire au moins 5 caractères.");
      return;
    }
    if (rolesChoisis.length === 0) {
      setErreur("Choisissez au moins un rôle ciblé.");
      return;
    }
    const cibleSchools = construireCibleSchools();
    if (cibleSchools.length === 0) {
      setErreur("Aucune école ne correspond à la cible.");
      return;
    }
    setEnvoiEnCours(true);
    try {
      await addDoc(collection(db, "superadmin_messages"), {
        titre: titre.trim(),
        corps: corps.trim(),
        niveau,
        cibleSchools,
        cibleRoles: rolesChoisis,
        auteur,
        createdAt: Date.now(),
      });
      setSucces(`Message envoyé à ${cibleSchools[0] === "*" ? "toutes les écoles" : `${cibleSchools.length} école${cibleSchools.length > 1 ? "s" : ""}`}.`);
      reinitFormulaire();
      setTimeout(() => setSucces(""), 4000);
    } catch (e) {
      setErreur(`Échec de l'envoi : ${e?.message || "erreur inconnue"}.`);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const supprimerMessage = async (id) => {
    if (!confirm("Supprimer ce message ? Les destinataires ne le verront plus.")) return;
    try {
      await deleteDoc(doc(db, "superadmin_messages", id));
    } catch (e) {
      alert(`Suppression impossible : ${e?.message || "erreur"}`);
    }
  };

  const inp = {
    width: "100%",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
  const lab = {
    display: "block",
    fontSize: 11,
    fontWeight: 700,
    color: C.blueDark,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 6,
  };

  const previewCible =
    modeCible === "toutes"
      ? `Toutes les écoles (${ecoles.length})`
      : modeCible === "plan"
        ? `Plan ${PLANS[planChoisi]?.label || planChoisi} — ${ecolesParPlan[planChoisi] || 0} école(s)`
        : `${schoolsChoisies.length} école(s) sélectionnée(s)`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Composer */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,32,80,0.08)", padding: "22px 24px" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: C.blueDark }}>
          📢 Composer un message
        </h3>

        {erreur && (
          <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#991b1b", fontWeight: 600 }}>
            {erreur}
          </div>
        )}
        {succes && (
          <div style={{ background: "#d1fae5", border: "1px solid #6ee7b7", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#065f46", fontWeight: 600 }}>
            ✅ {succes}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 14, marginBottom: 14 }}>
          <div>
            <label style={lab}>Titre</label>
            <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Titre court et clair" style={inp} maxLength={120} />
          </div>
          <div>
            <label style={lab}>Niveau</label>
            <select value={niveau} onChange={(e) => setNiveau(e.target.value)} style={inp}>
              {NIVEAUX.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lab}>Message</label>
          <textarea
            value={corps}
            onChange={(e) => setCorps(e.target.value)}
            placeholder="Texte professionnel, sans mise en forme. Les retours à la ligne sont conservés."
            rows={5}
            maxLength={2000}
            style={{ ...inp, resize: "vertical", lineHeight: 1.5 }}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>
            {corps.length}/2000 caractères
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lab}>Cibler les écoles</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[
              { id: "toutes", label: "Toutes" },
              { id: "plan", label: "Par plan" },
              { id: "selection", label: "Sélection" },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setModeCible(m.id)}
                style={{
                  padding: "7px 14px",
                  borderRadius: 8,
                  border: `2px solid ${modeCible === m.id ? C.blue : "#e5e7eb"}`,
                  background: modeCible === m.id ? "#e0f2fe" : "#fff",
                  color: modeCible === m.id ? C.blue : "#6b7280",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>

          {modeCible === "plan" && (
            <select value={planChoisi} onChange={(e) => setPlanChoisi(e.target.value)} style={inp}>
              {Object.entries(PLANS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label} — {ecolesParPlan[key] || 0} école(s)
                </option>
              ))}
            </select>
          )}

          {modeCible === "selection" && (
            <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 8, padding: 8 }}>
              {ecoles.length === 0 ? (
                <div style={{ padding: 12, textAlign: "center", fontSize: 12, color: "#9ca3af" }}>Aucune école.</div>
              ) : (
                ecoles.map((e) => (
                  <label key={e._id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", cursor: "pointer", borderRadius: 6, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={schoolsChoisies.includes(e._id)}
                      onChange={() => toggleSchool(e._id)}
                    />
                    <span style={{ flex: 1 }}>{e.nom}</span>
                    <code style={{ fontSize: 11, color: "#9ca3af" }}>{e._id}</code>
                  </label>
                ))
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lab}>Cibler les rôles (parent toujours exclu)</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ROLES_CIBLABLES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRole(r.id)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  border: `2px solid ${rolesChoisis.includes(r.id) ? C.green : "#e5e7eb"}`,
                  background: rolesChoisis.includes(r.id) ? "#d1fae5" : "#fff",
                  color: rolesChoisis.includes(r.id) ? "#065f46" : "#6b7280",
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {rolesChoisis.includes(r.id) ? "✓ " : ""}
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#374151" }}>
          <strong>Aperçu cible :</strong> {previewCible} · Rôles :{" "}
          {rolesChoisis.length === 0 ? "—" : rolesChoisis.map((r) => ROLES_CIBLABLES.find((x) => x.id === r)?.label).join(", ")}
        </div>

        <button
          onClick={envoyer}
          disabled={envoiEnCours}
          style={{
            background: `linear-gradient(90deg,${C.blue},${C.green})`,
            color: "#fff",
            border: "none",
            padding: "11px 22px",
            borderRadius: 9,
            fontSize: 13,
            fontWeight: 800,
            cursor: envoiEnCours ? "not-allowed" : "pointer",
            opacity: envoiEnCours ? 0.7 : 1,
          }}
        >
          {envoiEnCours ? "Envoi en cours…" : "📤 Envoyer le message"}
        </button>
      </div>

      {/* Historique */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 16px rgba(0,32,80,0.08)", padding: "22px 24px" }}>
        <h3 style={{ margin: "0 0 18px", fontSize: 16, fontWeight: 800, color: C.blueDark }}>
          📜 Historique ({messages.length})
        </h3>
        {messages.length === 0 ? (
          <div style={{ padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            Aucun message envoyé pour le moment.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((m) => {
              const niv = NIVEAUX.find((n) => n.id === m.niveau) || NIVEAUX[0];
              const stat = statsLectures[m._id] || { lectures: 0, ecoles: 0 };
              const cible =
                m.cibleSchools?.[0] === "*"
                  ? "Toutes les écoles"
                  : `${m.cibleSchools?.length || 0} école(s)`;
              return (
                <div
                  key={m._id}
                  style={{
                    border: `1px solid ${niv.bg}`,
                    borderLeft: `4px solid ${niv.couleur}`,
                    borderRadius: 10,
                    padding: "12px 14px",
                    background: "#fff",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <span style={{ background: niv.bg, color: niv.couleur, padding: "2px 9px", borderRadius: 12, fontSize: 10, fontWeight: 800 }}>
                      {niv.label.toUpperCase()}
                    </span>
                    <strong style={{ fontSize: 14, color: C.blueDark, flex: 1 }}>{m.titre}</strong>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {new Date(m.createdAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}
                    </span>
                    <button
                      onClick={() => supprimerMessage(m._id)}
                      title="Supprimer"
                      style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 13, padding: "2px 6px" }}
                    >
                      🗑
                    </button>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", whiteSpace: "pre-wrap" }}>{m.corps}</p>
                  <div style={{ display: "flex", gap: 14, fontSize: 11, color: "#6b7280", flexWrap: "wrap" }}>
                    <span>🎯 {cible}</span>
                    <span>👥 {(m.cibleRoles || []).join(", ")}</span>
                    <span>👁 {stat.ecoles} école(s) ont lu · {stat.lectures} lecture(s)</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunicationsAdmin;
