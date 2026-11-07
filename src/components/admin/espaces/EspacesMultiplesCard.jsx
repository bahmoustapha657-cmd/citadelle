import { useCallback, useEffect, useMemo, useState } from "react";
import { C } from "../../../constants";
import { chargerComptesEspaces, detacherCompte, relierComptes } from "../../../backend/espaces-supabase";
import { groupesRelies, libelleEspace, suggestionsEspaces } from "../../../espaces-comptes";
import { Badge, Btn } from "../../ui";

// ══════════════════════════════════════════════════════════════
//  Une personne, plusieurs espaces — Direction seulement
// ══════════════════════════════════════════════════════════════
// Une même personne peut être enseignant, parent d'élève et membre du
// personnel. Ses comptes reliés ici : connectée sur l'un, elle passe aux
// autres sans mot de passe (bouton « Espace »). Chaque compte garde son rôle
// et ses droits. Liaison : Edge account-manage (relier_comptes /
// detacher_compte), logique pure : espaces-comptes.js.
const carte = { background: "var(--lc-surface, #fff)", borderRadius: 14, padding: "20px 22px", marginBottom: 20, border: "1px solid #e2e8f0" };
const titreSection = { margin: "16px 0 6px", fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" };

function LigneCompte({ c, action }) {
  const l = libelleEspace(c);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderTop: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 18 }}>{l.icone}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{c.nom || c.login} <Badge color="blue">{l.titre}</Badge></div>
        <div style={{ fontSize: 11, color: "#64748b" }}>Identifiant : {c.login}{c.email ? ` · ${c.email}` : ""}</div>
      </div>
      {action}
    </div>
  );
}

export function EspacesMultiplesCard({ toast }) {
  const [comptes, setComptes] = useState(null);
  const [occupe, setOccupe] = useState(false);
  const [recherche, setRecherche] = useState("");
  const [choisis, setChoisis] = useState([]);

  const charger = useCallback(async () => {
    try { setComptes(await chargerComptesEspaces()); } catch (e) { toast(e.message, "error"); }
  }, [toast]);
  useEffect(() => { charger(); }, [charger]);

  const groupes = useMemo(() => groupesRelies(comptes || []), [comptes]);
  const suggestions = useMemo(() => suggestionsEspaces(comptes || []), [comptes]);
  const trouves = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    if (q.length < 2 || !comptes) return [];
    return comptes.filter((c) => c.role !== "superadmin" && c.user_id && !c.extra?.fusionneDans
      && [c.nom, c.login, c.email].some((v) => String(v || "").toLowerCase().includes(q))).slice(0, 12);
  }, [comptes, recherche]);

  const executer = async (fn, succes) => {
    setOccupe(true);
    try { await fn(); toast(succes, "success"); setChoisis([]); await charger(); }
    catch (e) { toast(e.message, "error"); }
    finally { setOccupe(false); }
  };
  const relier = (ids) => executer(() => relierComptes(ids),
    "Comptes reliés : la personne passe de l'un à l'autre avec le bouton « Espace », sans se reconnecter.");
  const detacher = (c) => {
    if (!window.confirm(`Détacher le compte « ${c.login} » ? La personne devra s'y connecter avec son propre identifiant et mot de passe.`)) return;
    executer(() => detacherCompte(c.id), "Compte détaché.");
  };
  const basculerChoix = (id) => setChoisis((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <div style={carte}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.blueDark }}>🔀 Une personne, plusieurs espaces</h3>
      <p style={{ margin: "3px 0 6px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        Une même personne peut être enseignant, parent d'élève et membre du personnel. Reliez ses comptes : elle se connecte
        une seule fois (avec l'identifiant et le mot de passe de l'un d'eux) puis passe d'un espace à l'autre avec le bouton
        « Espace », en bas à gauche. Chaque compte garde ses propres droits. Ne reliez que des comptes de la MÊME personne.
      </p>
      {!comptes ? <p style={{ fontSize: 12, color: "#64748b" }}>Chargement…</p> : (
        <>
          {suggestions.length > 0 && (
            <>
              <div style={titreSection}>Suggestions à vérifier</div>
              {suggestions.map((s) => (
                <div key={s.cle} style={{ border: "1px solid #fde68a", background: "#fffdf5", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Badge color="amber">{s.motif}</Badge>
                    <span style={{ flex: 1 }} />
                    <Btn sm disabled={occupe} onClick={() => relier(s.comptes.map((c) => c.id))}>🔗 Relier ces comptes</Btn>
                  </div>
                  {s.comptes.map((c) => <LigneCompte key={c.id} c={c} />)}
                </div>
              ))}
            </>
          )}

          <div style={titreSection}>Relier des comptes</div>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un compte (nom, identifiant, e-mail)…"
            style={{ width: "100%", boxSizing: "border-box", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 11px", fontSize: 13 }} />
          {trouves.map((c) => (
            <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={choisis.includes(c.id)} onChange={() => basculerChoix(c.id)} />
              <div style={{ flex: 1 }}><LigneCompte c={c} /></div>
            </label>
          ))}
          {choisis.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: "#475569" }}>
                {choisis.length} compte{choisis.length > 1 ? "s" : ""} choisi{choisis.length > 1 ? "s" : ""} :{" "}
                {choisis.map((id) => comptes.find((c) => c.id === id)?.login).filter(Boolean).join(", ")}
              </span>
              <Btn sm v="ghost" onClick={() => setChoisis([])}>Vider</Btn>
              <Btn sm disabled={occupe || choisis.length < 2} onClick={() => relier(choisis)}>🔗 Relier ({choisis.length})</Btn>
            </div>
          )}

          <div style={titreSection}>Personnes reliées ({groupes.length})</div>
          {groupes.length === 0 && <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Aucun compte relié pour l'instant.</p>}
          {groupes.map((g) => (
            <div key={g.personneId} style={{ border: "1px solid #c7d2fe", background: "#f8faff", borderRadius: 10, padding: "8px 12px", marginBottom: 8 }}>
              {g.comptes.map((c) => (
                <LigneCompte key={c.id} c={c} action={<Btn sm v="ghost" disabled={occupe} onClick={() => detacher(c)}>Détacher</Btn>} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
