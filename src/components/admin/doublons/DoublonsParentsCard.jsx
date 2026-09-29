import { C } from "../../../constants";
import { telephoneLisible } from "../../../comptes-parents";
import { Badge, Btn } from "../../ui";
import { useDoublonsParents } from "./use-doublons-parents";

// ══════════════════════════════════════════════════════════════
//  Doublons parents — un parent, plusieurs comptes : fusion validée
// ══════════════════════════════════════════════════════════════
// Logique dans use-doublons-parents.js (détection : doublons-parents.js ;
// fusion : Edge Function account-manage).
export function DoublonsParentsCard({ schoolId, toast }) {
  const d = useDoublonsParents({ schoolId, toast });
  const restants = d.visibles.filter((g) => !d.faits[g.cle]).length;
  return (
    <div style={{ background: "var(--lc-surface, #fff)", borderRadius: 14, padding: "20px 22px", marginBottom: 20, border: "1px solid #e2e8f0" }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: C.blueDark }}>👪 Doublons parents</h3>
      <p style={{ margin: "3px 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        Comptes parents qui semblent appartenir au même parent : même numéro de téléphone, ou même nom et même filiation.
        Examinez chaque groupe : la fusion rattache tous les enfants au compte conservé — qui garde son identifiant et son
        mot de passe — et désactive les autres. Un même numéro peut servir à plusieurs familles : dans le doute, ne fusionnez pas.
      </p>
      <Btn onClick={d.analyser} disabled={d.chargement}>
        {d.chargement ? "⏳ Analyse…" : d.groupes ? "🔄 Relancer l'analyse" : "🔍 Rechercher les doublons"}
      </Btn>
      {d.groupes && (
        restants
          ? <p style={{ margin: "12px 0 0", fontSize: 12, color: "#64748b" }}>{restants} groupe{restants > 1 ? "s" : ""} à examiner.</p>
          : <p style={{ margin: "12px 0 0", fontSize: 13, color: "#166534" }}>
            ✅ {d.visibles.length ? "Tous les groupes affichés sont traités." : "Aucun doublon à examiner."}
          </p>
      )}
      {d.visibles.map((g) => <Groupe key={g.cle} g={g} d={d}/>)}
    </div>
  );
}

const sousLigne = { fontSize: 12, color: "#64748b", marginTop: 2, lineHeight: 1.45 };
const actif = (c) => !c.statut || c.statut === "Actif";
const dateCourte = (iso) => (iso ? new Date(iso).toLocaleDateString("fr-FR") : "");

function Groupe({ g, d }) {
  const fait = d.faits[g.cle];
  const cibleId = d.cibleDe(g);
  const cible = g.comptes.find((c) => c.id === cibleId);
  const meme = g.verdict === "meme";
  return (
    <div style={{ marginTop: 12, border: `1px solid ${meme ? "#bbf7d0" : "#fde68a"}`, borderRadius: 10, padding: "12px 14px", background: meme ? "#f7fef9" : "#fffdf5" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Badge color={meme ? "green" : "amber"}>{meme ? "Même parent probable" : "À vérifier : noms différents"}</Badge>
        <span style={{ fontSize: 12, color: "#475569" }}>
          {g.telephone ? `Même numéro : ${telephoneLisible(g.telephone)}` : "Même nom et même filiation"}
        </span>
      </div>

      {fait ? <Resultat g={g} d={d} fait={fait}/> : (
        <>
          <p style={{ margin: "10px 0 4px", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Compte à conserver
          </p>
          {g.comptes.map((c) => (
            <label key={c.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 0", borderTop: "1px solid #f1f5f9", cursor: actif(c) ? "pointer" : "default" }}>
              <input type="radio" name={`cible-${g.cle}`} checked={cibleId === c.id} disabled={!actif(c)}
                onChange={() => d.choisirCible(g, c.id)} style={{ marginTop: 3 }}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: 13 }}>{c.login}</strong>{" "}
                {cibleId === c.id && <Badge color="blue">Conservé</Badge>}{" "}
                {!actif(c) && <Badge color="gray">Inactif</Badge>}
                <div style={sousLigne}>
                  {[c.nom, c.telephone && telephoneLisible(c.telephone),
                    c.premiere_co === false ? "déjà utilisé par le parent" : "jamais connecté",
                    c.created_at && `créé le ${dateCourte(c.created_at)}`].filter(Boolean).join(" · ")}
                </div>
                <div style={sousLigne}>
                  {c.enfants.length
                    ? c.enfants.map((e) => `${e.prenom} ${e.nom}${e.classe ? ` (${e.classe})` : ""}`).join(", ")
                    : "Aucun enfant rattaché"}
                </div>
              </div>
            </label>
          ))}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Btn sm v="ghost" onClick={() => d.masquer(g)} disabled={d.enCours === g.cle}>Pas le même parent — masquer</Btn>
            <Btn sm v="purple" onClick={() => d.fusionner(g)} disabled={Boolean(d.enCours) || !cible}>
              {d.enCours === g.cle ? "⏳ Fusion…" : `Fusionner dans « ${cible?.login || "…"} »`}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

function Resultat({ g, d, fait }) {
  return (
    <div style={{ marginTop: 10, fontSize: 12.5, color: "#166534", lineHeight: 1.6 }}>
      ✅ Fusionné dans <strong>{fait.login}</strong> : {fait.absorbes.join(", ")} désactivé{fait.absorbes.length > 1 ? "s" : ""}
      {fait.liensDeplaces ? `, ${fait.liensDeplaces} enfant${fait.liensDeplaces > 1 ? "s" : ""} rattaché${fait.liensDeplaces > 1 ? "s" : ""}` : ""}.
      Le parent se connecte désormais avec <strong>{fait.login}</strong>.
      {fait.nouveauMdp ? (
        <div style={{ marginTop: 6, padding: "8px 10px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8 }}>
          Nouveau mot de passe de <strong>{fait.login}</strong> : <strong style={{ fontFamily: "monospace" }}>{fait.nouveauMdp}</strong> —
          à remettre au parent, qui le changera à sa prochaine connexion.
        </div>
      ) : (
        <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", color: "#475569" }}>
          Le parent ne connaît pas ce mot de passe ?
          <Btn sm v="ghost" onClick={() => d.reinitialiser(g)} disabled={d.enCours === g.cle}>
            {d.enCours === g.cle ? "⏳ …" : `Réinitialiser le mot de passe de « ${fait.login} »`}
          </Btn>
        </div>
      )}
    </div>
  );
}
