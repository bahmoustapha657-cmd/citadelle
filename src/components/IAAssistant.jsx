import { useState, useContext } from "react";
import { SchoolContext } from "../App";

const C = { blue: "#0A1628", green: "#00C48C", blueDark: "#0A1628" };

// ── Hook d'appel à l'API IA ─────────────────────────────────
export function useIA() {
  const { schoolId } = useContext(SchoolContext);

  const genererCommentaire = async ({ eleve, moyenneGenerale, mention, matieres, periode, niveau }) => {
    const res = await fetch("/api/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "commentaire_bulletin",
        schoolId,
        payload: { eleve, moyenneGenerale, mention, matieres, periode, niveau },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erreur IA");
    }
    return (await res.json()).commentaire;
  };

  const genererDocument = async ({ type, eleve, contexte }) => {
    const res = await fetch("/api/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "generer_document", schoolId, payload: { type, eleve, contexte } }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erreur IA");
    }
    return (await res.json()).document;
  };

  return { genererCommentaire, genererDocument };
}

// ── Bouton commentaire IA (à placer dans le bulletin) ────────
export function BoutonCommentaireIA({ eleve, moyenneGenerale, mention, matieres, periode, niveau }) {
  const { genererCommentaire } = useIA();
  const [loading, setLoading] = useState(false);
  const [commentaire, setCommentaire] = useState("");
  const [modal, setModal] = useState(false);
  const [erreur, setErreur] = useState("");

  const generer = async () => {
    setLoading(true); setModal(true); setErreur(""); setCommentaire("");
    try {
      const c = await genererCommentaire({ eleve, moyenneGenerale, mention, matieres, periode, niveau });
      setCommentaire(c);
    } catch (e) {
      setErreur(e.message || "Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button onClick={generer}
        style={{
          background: "linear-gradient(90deg,#4f46e5,#7c3aed)",
          color: "#fff", border: "none", padding: "5px 12px",
          borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>
        ✨ IA
      </button>

      {modal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Segoe UI',system-ui,sans-serif",
        }} onClick={() => setModal(false)}>
          <div style={{
            background: "#fff", borderRadius: 16, padding: "28px 32px",
            width: "100%", maxWidth: 520, boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 24 }}>✨</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: C.blueDark }}>Commentaire IA</h3>
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                  {eleve?.nom} {eleve?.prenom} — {eleve?.classe} — Moy. {moyenneGenerale}/20
                </p>
              </div>
            </div>

            {loading && (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <div style={{ fontSize: 32, marginBottom: 10 }}>🤖</div>
                <p style={{ color: "#6b7280", fontSize: 14 }}>Génération en cours…</p>
              </div>
            )}

            {erreur && (
              <div style={{ background: "#fee2e2", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#991b1b" }}>
                {erreur}
              </div>
            )}

            {commentaire && (
              <>
                <div style={{
                  background: "#f0f6ff", borderRadius: 10, padding: "16px 18px",
                  fontSize: 14, lineHeight: 1.75, color: "#1e293b",
                  borderLeft: `4px solid ${C.blue}`, marginBottom: 16,
                }}>
                  {commentaire}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => { navigator.clipboard.writeText(commentaire); }}
                    style={{ flex: 1, background: C.blue, color: "#fff", border: "none", padding: "10px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    📋 Copier
                  </button>
                  <button onClick={generer}
                    style={{ flex: 1, background: "#f0f4ff", color: "#4f46e5", border: "none", padding: "10px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                    🔄 Régénérer
                  </button>
                </div>
              </>
            )}

            <button onClick={() => setModal(false)}
              style={{ width: "100%", marginTop: 12, background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "9px", cursor: "pointer", fontSize: 13, color: "#6b7280" }}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Module IA complet (page dédiée) ─────────────────────────
export default function ModuleIA() {
  const { genererDocument } = useIA();
  const [onglet, setOnglet] = useState("documents"); // documents | aide
  const [typeDoc, setTypeDoc] = useState("courrier_tuteur");
  const [form, setForm] = useState({
    nomEleve: "", prenomEleve: "", classe: "", contexte: "",
  });
  const [loading, setLoading] = useState(false);
  const [resultat, setResultat] = useState("");
  const [erreur, setErreur] = useState("");

  const chg = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const generer = async () => {
    if (!form.nomEleve.trim() || !form.contexte.trim()) {
      setErreur("Remplissez le nom de l'élève et le contexte."); return;
    }
    setLoading(true); setErreur(""); setResultat("");
    try {
      const doc = await genererDocument({
        type: typeDoc,
        eleve: { nom: form.nomEleve, prenom: form.prenomEleve, classe: form.classe },
        contexte: form.contexte,
      });
      setResultat(doc);
    } catch (e) {
      setErreur(e.message || "Erreur lors de la génération.");
    } finally {
      setLoading(false);
    }
  };

  const TYPES_DOC = [
    { id: "courrier_tuteur", label: "📨 Courrier au tuteur", desc: "Convocation, information, invitation" },
    { id: "attestation_perso", label: "📄 Attestation personnalisée", desc: "Mérite, participation, engagement" },
    { id: "certificat_scolarite", label: "🎓 Certificat de scolarité", desc: "Justificatif de présence" },
    { id: "rapport_comportement", label: "📝 Rapport de comportement", desc: "Incident, avertissement, félicitations" },
  ];

  const S = {
    page: { padding: "28px 32px", fontFamily: "'Segoe UI',system-ui,sans-serif", maxWidth: 800, margin: "0 auto" },
    card: { background: "#fff", borderRadius: 14, padding: "24px 28px", boxShadow: "0 2px 16px rgba(0,32,80,0.07)", marginBottom: 20 },
    inp: { width: "100%", border: "1.5px solid #d1d5db", borderRadius: 9, padding: "10px 14px", fontSize: 13, outline: "none", boxSizing: "border-box" },
    lbl: { display: "block", fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 5, marginTop: 14 },
    btn: (bg) => ({ background: bg || `linear-gradient(90deg,${C.blue},${C.green})`, color: "#fff", border: "none", padding: "11px 20px", borderRadius: 9, fontWeight: 800, cursor: "pointer", fontSize: 13 }),
  };

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: C.blueDark }}>
          ✨ Assistant IA
        </h2>
        <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
          Génération intelligente de documents scolaires · Propulsé par Claude AI
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {[
          { id: "documents", label: "📄 Générer des documents" },
          { id: "aide", label: "❓ Guide d'utilisation" },
        ].map(o => (
          <button key={o.id} onClick={() => setOnglet(o.id)}
            style={{
              padding: "9px 18px", borderRadius: 9, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13,
              background: onglet === o.id ? C.blue : "#f0f4f8",
              color: onglet === o.id ? "#fff" : "#6b7280",
            }}>
            {o.label}
          </button>
        ))}
      </div>

      {onglet === "documents" && (
        <>
          {/* Type de document */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>
              Type de document
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 10 }}>
              {TYPES_DOC.map(t => (
                <button key={t.id} onClick={() => setTypeDoc(t.id)}
                  style={{
                    padding: "12px 14px", borderRadius: 10, cursor: "pointer", textAlign: "left",
                    border: `2px solid ${typeDoc === t.id ? C.blue : "#e5e7eb"}`,
                    background: typeDoc === t.id ? "#f0f6ff" : "#fff",
                    transition: "all .15s",
                  }}>
                  <p style={{ margin: "0 0 3px", fontWeight: 800, fontSize: 13, color: typeDoc === t.id ? C.blue : "#374151" }}>
                    {t.label}
                  </p>
                  <p style={{ margin: 0, fontSize: 11, color: "#9ca3af" }}>{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Formulaire */}
          <div style={S.card}>
            <h3 style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 800, color: C.blueDark }}>
              Informations
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
              <div>
                <label style={S.lbl}>Nom de l'élève *</label>
                <input style={S.inp} value={form.nomEleve} onChange={chg("nomEleve")} placeholder="Ex. : DIALLO"/>
              </div>
              <div>
                <label style={S.lbl}>Prénom</label>
                <input style={S.inp} value={form.prenomEleve} onChange={chg("prenomEleve")} placeholder="Ex. : Aminata"/>
              </div>
              <div>
                <label style={S.lbl}>Classe</label>
                <input style={S.inp} value={form.classe} onChange={chg("classe")} placeholder="Ex. : 9ème A"/>
              </div>
            </div>
            <label style={S.lbl}>Contexte / Objet du document *</label>
            <textarea
              value={form.contexte} onChange={chg("contexte")}
              placeholder="Décrivez l'objet du document. Ex. : Convocation des parents pour une réunion le 15 avril concernant les résultats du 2ème trimestre..."
              style={{ ...S.inp, height: 100, resize: "vertical", lineHeight: 1.6 }}/>

            {erreur && (
              <div style={{ background: "#fee2e2", borderRadius: 8, padding: "9px 14px", fontSize: 13, color: "#991b1b", marginTop: 12 }}>
                {erreur}
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <button onClick={generer} disabled={loading} style={{ ...S.btn(), opacity: loading ? 0.7 : 1 }}>
                {loading ? "🤖 Génération en cours…" : "✨ Générer le document"}
              </button>
            </div>
          </div>

          {/* Résultat */}
          {resultat && (
            <div style={S.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: C.blueDark }}>
                  ✅ Document généré
                </h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => navigator.clipboard.writeText(resultat)}
                    style={S.btn("#4f46e5")}>
                    📋 Copier
                  </button>
                  <button onClick={() => window.print()}
                    style={S.btn(C.green)}>
                    🖨️ Imprimer
                  </button>
                  <button onClick={generer}
                    style={S.btn("#6b7280")}>
                    🔄 Régénérer
                  </button>
                </div>
              </div>
              <div style={{
                background: "#fafafa", borderRadius: 10, padding: "20px 24px",
                fontSize: 14, lineHeight: 1.85, color: "#1e293b",
                border: "1px solid #e5e7eb", whiteSpace: "pre-wrap",
                fontFamily: "'Times New Roman', serif",
              }}>
                {resultat}
              </div>
            </div>
          )}
        </>
      )}

      {onglet === "aide" && (
        <div style={S.card}>
          <h3 style={{ margin: "0 0 16px", color: C.blueDark }}>Comment utiliser l'Assistant IA ?</h3>
          {[
            { titre: "📄 Génération de documents", texte: "Sélectionnez le type de document souhaité, renseignez les informations de l'élève et décrivez l'objet du document. L'IA rédigera un document professionnel adapté au contexte scolaire guinéen." },
            { titre: "✨ Commentaires sur bulletins", texte: "Dans la section Bulletins de chaque module, un bouton '✨ IA' apparaît sur chaque élève. Cliquez dessus pour générer automatiquement un commentaire personnalisé basé sur les résultats." },
            { titre: "📋 Copier et utiliser", texte: "Copiez le texte généré et collez-le dans votre traitement de texte préféré, ou imprimez directement depuis l'application." },
            { titre: "🔄 Régénérer", texte: "Si le résultat ne vous convient pas, cliquez sur Régénérer pour obtenir une nouvelle version. Chaque génération est unique." },
          ].map(({ titre, texte }) => (
            <div key={titre} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid #f0f0f0" }}>
              <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 14, color: C.blueDark }}>{titre}</p>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>{texte}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
