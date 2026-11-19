import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modale } from "../ui";
import { CATEGORIES, ARTICLES } from "./centre-aide-contenu";
import { RetourTerrain } from "./RetourTerrain";

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Centre d'aide intégré : articles « pas à pas » filtrés selon le rôle de
// l'utilisateur, recherche plein texte, et bloc de contact (WhatsApp / tél /
// e-mail). Accessible depuis le menu profil.
// Retours terrain : depuis le bloc de contact (ou une recherche sans
// résultat), un compte d'école signale un problème ou propose une idée à
// EduGest (RetourTerrain.jsx) ; `ecran` = page ouverte, jointe à l'envoi.
export function CentreAideModal({ utilisateur = {}, onClose, ecran = "", peutSignaler = false }) {
  const { t } = useTranslation();
  // null = articles d'aide ; sinon panneau de retour, pré-rempli.
  const [retour, setRetour] = useState(null);
  // Clé effective : le poste prime sur le rôle enum (postes système = mêmes
  // clés que les rôles historiques ; direction voit tout).
  const role = utilisateur.posteCle || utilisateur.role || "";
  const [q, setQ] = useState("");
  const [ouvert, setOuvert] = useState(null); // id article déplié

  // Articles visibles pour ce rôle, filtrés par la recherche.
  const articles = useMemo(() => {
    const parRole = ARTICLES.filter((a) => !a.roles || a.roles.includes(role));
    if (!q.trim()) return parRole;
    const nq = norm(q);
    return parRole.filter((a) => norm(`${a.titre} ${a.etapes.join(" ")}`).includes(nq));
  }, [role, q]);

  const categoriesAff = CATEGORIES.filter((c) => articles.some((a) => a.cat === c.id));

  if (retour) {
    return (
      <Modale large titre={t("feedback.title")} fermer={onClose}>
        <RetourTerrain ecran={ecran} genreInitial={retour.genre} messageInitial={retour.message} onRetour={() => setRetour(null)} />
      </Modale>
    );
  }

  const boutonRetour = {
    display: "inline-flex", alignItems: "center", gap: 6, background: "#0A1628", color: "#fff", border: "none",
    borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  };

  return (
    <Modale xlarge titre="❓ Centre d'aide" fermer={onClose}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="🔍 Rechercher une aide (ex. bulletin, paiement, mot de passe…)"
        style={{ width: "100%", border: "1px solid #b0c4d8", borderRadius: 9, padding: "10px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box" }}
      />

      <div style={{ maxHeight: "58vh", overflowY: "auto" }}>
        {categoriesAff.length === 0 && (
          <p style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "24px 0" }}>
            Aucune aide ne correspond à « {q} ».
          </p>
        )}
        {categoriesAff.length === 0 && peutSignaler && (
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <button type="button" style={boutonRetour} onClick={() => setRetour({ genre: "question", message: q.trim() })}>
              {t("feedback.askQuestion")}
            </button>
          </div>
        )}

        {categoriesAff.map((cat) => (
          <div key={cat.id} style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 13, fontWeight: 800, color: "#0A1628", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.04em" }}>{cat.label}</h3>
            {articles.filter((a) => a.cat === cat.id).map((a) => {
              const plie = ouvert === a.id;
              return (
                <div key={a.id} style={{ border: "1px solid #e2e8f0", borderRadius: 9, marginBottom: 7, overflow: "hidden", background: "#fff" }}>
                  <button
                    type="button"
                    onClick={() => setOuvert(plie ? null : a.id)}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", background: plie ? "#f0f7ff" : "#fff", border: "none", cursor: "pointer", textAlign: "start", fontSize: 13.5, fontWeight: 700, color: "#1e293b" }}
                  >
                    <span style={{ flex: 1 }}>{a.titre}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>{plie ? "▲" : "▼"}</span>
                  </button>
                  {plie && (
                    <ol style={{ margin: 0, padding: "4px 28px 14px", fontSize: 13, color: "#374151", lineHeight: 1.7 }}>
                      {a.etapes.map((etape, i) => <li key={i} style={{ marginBottom: 4 }}>{etape}</li>)}
                    </ol>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, borderTop: "1px solid #e2e8f0", paddingTop: 14 }}>
        <p style={{ margin: "0 0 8px", fontSize: 13, fontWeight: 800, color: "#0A1628" }}>Besoin d'aide supplémentaire ?</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {peutSignaler && (
            <button type="button" style={boutonRetour} onClick={() => setRetour({})}>
              {t("feedback.open")}
            </button>
          )}
          <a href="https://wa.me/224627738579" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#22c55e", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>💬 WhatsApp</a>
          <a href="tel:+224627738579" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #b0c4d8", color: "#334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>📞 +224 627 73 85 79</a>
          <a href="mailto:edugest26@gmail.com" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #b0c4d8", color: "#334155", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>✉️ edugest26@gmail.com</a>
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 11, color: "#94a3b8" }}>
          Voir aussi la <a href="/politique-confidentialite.html" target="_blank" rel="noreferrer" style={{ color: "#0a7d5a", fontWeight: 700 }}>Politique de confidentialité</a>.
        </p>
      </div>
    </Modale>
  );
}
