import { useState } from "react";
import { C } from "../../../constants";
import { Btn, Badge } from "../../ui";
import { usePostesCard } from "./use-postes-card";
import { MODULE_OPTIONS, cyclePermission, estPosteSupprimable, estPosteVerrouille, suggererLogin } from "./postes-logic";

// ── Matrice de permissions d'un poste : clic = ∅ → 👁 lecture → ✏️ écriture ──
function MatricePermissions({ permissions, onCycle, verrouille }) {
  const niveau = (moduleId) => permissions[moduleId] || null;
  const rendu = (moduleId) => (niveau(moduleId) === "ecriture" ? "✏️ Écriture"
    : niveau(moduleId) === "lecture" ? "👁 Lecture" : "— Invisible");
  const fond = (moduleId) => (niveau(moduleId) === "ecriture" ? "#dcfce7"
    : niveau(moduleId) === "lecture" ? "#e0f2fe" : "#f1f5f9");
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 6, marginTop: 10 }}>
      {MODULE_OPTIONS.map((m) => (
        <button key={m.id} type="button" disabled={verrouille}
          onClick={() => onCycle(m.id)}
          title={verrouille ? "Poste direction : tous droits, non modifiable" : `${m.label} — cliquer pour changer le droit`}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8,
            padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0",
            background: verrouille ? "#dcfce7" : fond(m.id), cursor: verrouille ? "default" : "pointer",
            fontSize: 12, fontWeight: 600, color: "#1f2937", opacity: verrouille ? 0.75 : 1 }}>
          <span>{m.icon} {m.label}</span>
          <span style={{ fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>
            {verrouille ? "✏️ Écriture" : rendu(m.id)}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Comptes rattachés à un poste + ajout d'un nouveau compte ────────────────
function ComptesDuPoste({ poste, comptes, onCreer, toast }) {
  const [ajout, setAjout] = useState(false);
  const [nom, setNom] = useState("");
  const [login, setLogin] = useState("");
  const [creationEnCours, setCreationEnCours] = useState(false);

  const ouvrir = () => { setAjout(true); setNom(""); setLogin(suggererLogin(poste, comptes)); };
  const creer = async () => {
    const loginPropre = login.trim().toLowerCase();
    if (loginPropre.length < 3) { toast("Identifiant : 3 caractères minimum.", "warning"); return; }
    setCreationEnCours(true);
    try {
      await onCreer(poste, { nom: nom.trim(), login: loginPropre });
      setAjout(false);
    } catch (e) {
      toast(e.message || "Création du compte impossible.", "error");
    } finally {
      setCreationEnCours(false);
    }
  };

  return (
    <div style={{ marginTop: 12, borderTop: "1px dashed #e2e8f0", paddingTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
          Comptes du poste ({comptes.length})
        </span>
        {poste.actif && <Btn sm v="success" onClick={ouvrir}>+ Ajouter un compte</Btn>}
      </div>
      {comptes.map((c) => (
        <div key={c._id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, padding: "5px 0", color: "#334155" }}>
          <span style={{ fontFamily: "monospace", background: "#f1f5f9", padding: "1px 6px", borderRadius: 4 }}>{c.login}</span>
          <span style={{ fontWeight: 600 }}>{c.nom}</span>
          {c.premiereCo && <Badge color="amber">1ère connexion à faire</Badge>}
        </div>
      ))}
      {comptes.length === 0 && <p style={{ margin: "6px 0 0", fontSize: 12, color: "#94a3b8" }}>Aucun compte pour ce poste.</p>}
      {ajout && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8, alignItems: "center", background: "#f8fafc", padding: "8px 10px", borderRadius: 8 }}>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom complet"
            style={{ flex: 1, minWidth: 140, padding: "7px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12 }} />
          <input value={login} onChange={(e) => setLogin(e.target.value)} placeholder="identifiant"
            style={{ width: 140, padding: "7px 10px", borderRadius: 7, border: "1px solid #cbd5e1", fontSize: 12, fontFamily: "monospace" }} />
          <Btn sm v="primary" disabled={creationEnCours} onClick={creer}>{creationEnCours ? "…" : "Créer"}</Btn>
          <Btn sm v="ghost" onClick={() => setAjout(false)}>Annuler</Btn>
          <span style={{ width: "100%", fontSize: 11, color: "#64748b" }}>
            Mot de passe généré automatiquement — affiché une seule fois après création.
          </span>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  Comptes & Postes — postes flexibles (mode Supabase)
// ══════════════════════════════════════════════════════════════
// Chaque poste porte un libellé libre et des droits par module ; plusieurs
// comptes peuvent partager un poste. Direction : verrouillée (tous droits).
export function PostesCard({ schoolId, peutGererRoles, comptes, refreshComptes, toast, setMdpsInitiaux }) {
  const p = usePostesCard({ schoolId, peutGererRoles, comptes, refreshComptes, toast, setMdpsInitiaux });

  return (
    <div style={{ background: "var(--lc-surface, #fff)", borderRadius: 14, padding: "20px 22px", marginBottom: 20, border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.blueDark }}>🧩 Comptes & Postes</h3>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#64748b" }}>
            Créez les postes de VOTRE école (censeur, économe, secrétariat…), réglez leurs droits
            module par module et ouvrez autant de comptes que nécessaire par poste.
          </p>
        </div>
        {peutGererRoles && <Btn sm v="primary" onClick={p.nouveauPoste}>+ Nouveau poste</Btn>}
      </div>

      {p.chargementPostes && <p style={{ fontSize: 12, color: "#94a3b8" }}>Chargement des postes…</p>}

      {p.postes.map((poste) => {
        const verrouille = estPosteVerrouille(poste);
        const enEdition = p.posteEdite?.id === poste.id;
        return (
          <div key={poste.id} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginTop: 10, opacity: poste.actif ? 1 : 0.55 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13, color: C.blueDark }}>{poste.label}</strong>
              <span style={{ fontSize: 11, fontFamily: "monospace", color: "#94a3b8" }}>({poste.cle})</span>
              {poste.systeme && <Badge color="blue">Système</Badge>}
              {verrouille && <Badge color="green">Tous droits</Badge>}
              {!poste.actif && <Badge color="red">Désactivé</Badge>}
              <span style={{ flex: 1 }} />
              {peutGererRoles && !verrouille && (
                <>
                  <Btn sm v="ghost" onClick={() => (enEdition ? p.setPosteEdite(null) : p.editerPoste(poste))}>
                    {enEdition ? "Fermer" : "✏️ Droits & nom"}
                  </Btn>
                  <Btn sm v={poste.actif ? "amber" : "success"} onClick={() => p.basculerActif(poste)}>
                    {poste.actif ? "Désactiver" : "Réactiver"}
                  </Btn>
                  {estPosteSupprimable(poste) && (
                    <Btn sm v="red" onClick={() => p.retirerPoste(poste)}>Supprimer</Btn>
                  )}
                </>
              )}
            </div>

            {enEdition && p.posteEdite && (
              <div style={{ marginTop: 10 }}>
                <input value={p.posteEdite.label}
                  onChange={(e) => p.setPosteEdite((prev) => ({ ...prev, label: e.target.value }))}
                  placeholder="Nom du poste (ex. Censeur des études)"
                  style={{ width: "100%", maxWidth: 380, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 }} />
                <MatricePermissions
                  permissions={p.posteEdite.permissions}
                  verrouille={false}
                  onCycle={(moduleId) => p.setPosteEdite((prev) => ({ ...prev, permissions: cyclePermission(prev.permissions, moduleId) }))}
                />
                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <Btn sm v="primary" disabled={p.sauvegardeEnCours} onClick={p.enregistrerPoste}>
                    {p.sauvegardeEnCours ? "Enregistrement…" : "💾 Enregistrer le poste"}
                  </Btn>
                  <Btn sm v="ghost" onClick={() => p.setPosteEdite(null)}>Annuler</Btn>
                </div>
              </div>
            )}

            {verrouille && (
              <MatricePermissions permissions={poste.permissions} verrouille onCycle={() => {}} />
            )}

            <ComptesDuPoste poste={poste} comptes={p.comptesDuPoste(poste)} onCreer={p.creerCompteDuPoste} toast={toast} />
          </div>
        );
      })}

      {/* Nouveau poste (pas encore d'id) */}
      {p.posteEdite && !p.posteEdite.id && (
        <div style={{ border: "2px dashed #93c5fd", borderRadius: 10, padding: "12px 14px", marginTop: 10, background: "#f0f9ff" }}>
          <strong style={{ fontSize: 13, color: C.blueDark }}>Nouveau poste</strong>
          <div style={{ marginTop: 8 }}>
            <input value={p.posteEdite.label} autoFocus
              onChange={(e) => p.setPosteEdite((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Nom du poste (ex. Censeur des études)"
              style={{ width: "100%", maxWidth: 380, padding: "8px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13, fontWeight: 600 }} />
            <MatricePermissions
              permissions={p.posteEdite.permissions}
              verrouille={false}
              onCycle={(moduleId) => p.setPosteEdite((prev) => ({ ...prev, permissions: cyclePermission(prev.permissions, moduleId) }))}
            />
            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
              <Btn sm v="primary" disabled={p.sauvegardeEnCours} onClick={p.enregistrerPoste}>
                {p.sauvegardeEnCours ? "Création…" : "💾 Créer le poste"}
              </Btn>
              <Btn sm v="ghost" onClick={() => p.setPosteEdite(null)}>Annuler</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
