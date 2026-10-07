import { useMemo, useState } from "react";
import { Avatar } from "./Avatar";
import { estJoignable, libellePresence, normaliser } from "./messagerie-logic";
import { useMessagerie } from "./messagerie-contexte";
import { champ, puce } from "./styles-messagerie";

const FILTRES = [["tous", "Tous"], ["personnel", "Personnel"], ["enseignants", "Enseignants"], ["parents", "Parents"], ["en_ligne", "🟢 En ligne"]];
const familleDe = (c) => (c.role === "enseignant" ? "enseignants" : c.role === "parent" ? "parents" : "personnel");

// Liste de comptes filtrable (recherche + personnel / enseignants / parents).
// Un filtre n'apparaît que si la liste contient des comptes de sa famille.
// Choix unique (`onChoisir`) ou multiple (`selection` + `onBasculer`).
export function SelecteurComptes({ comptes, onChoisir, selection, onBasculer, exclus = [], hauteur = 300 }) {
  const [recherche, setRecherche] = useState("");
  const [filtre, setFiltre] = useState("tous");
  const presences = useMessagerie()?.presences;
  const multiple = !!onBasculer;
  const choisis = useMemo(() => new Set(selection || []), [selection]);
  const sansExclus = useMemo(() => new Set(exclus), [exclus]);

  const familles = useMemo(() => new Set(comptes.map(familleDe)), [comptes]);
  const filtres = FILTRES.filter(([cle]) => cle === "tous" || cle === "en_ligne" || (familles.size > 1 && familles.has(cle)));

  const visibles = useMemo(() => {
    const terme = normaliser(recherche);
    return comptes.filter((c) => !sansExclus.has(c.id)
      && (filtre === "tous"
        || (filtre === "en_ligne" ? estJoignable(presences?.get(c.id)) : familleDe(c) === filtre))
      && (!terme || normaliser(`${c.nom} ${c.poste} ${c.login}`).includes(terme)));
  }, [comptes, recherche, filtre, sansExclus, presences]);

  return (
    <div>
      <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
        placeholder={familles.has("parents") ? "🔍 Rechercher un nom, un poste, un élève…" : "🔍 Rechercher un nom, un poste…"}
        style={{ ...champ, marginBottom: 8 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {filtres.map(([cle, libelle]) => (
          <button key={cle} type="button" onClick={() => setFiltre(cle)} style={puce(filtre === cle)}>{libelle}</button>
        ))}
        {multiple && choisis.size > 0 && (
          <span style={{ marginInlineStart: "auto", fontSize: 12, fontWeight: 700, color: "var(--sc1)", alignSelf: "center" }}>
            {choisis.size} sélectionné{choisis.size > 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div style={{ maxHeight: hauteur, overflowY: "auto", border: "1px solid var(--lc-border)", borderRadius: 10 }}>
        {visibles.length === 0 && (
          <p style={{ padding: 14, margin: 0, fontSize: 12, color: "var(--lc-text-faint)", textAlign: "center" }}>Aucun compte trouvé.</p>
        )}
        {visibles.map((c) => {
          const coche = choisis.has(c.id);
          return (
            <button key={c.id} type="button"
              onClick={() => (multiple ? onBasculer(c.id) : onChoisir(c))}
              style={{
                display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "start", cursor: "pointer",
                padding: "8px 10px", border: "none", borderBottom: "1px solid var(--lc-border-soft)",
                background: coche ? "var(--sc1-lt)" : "var(--lc-surface)", color: "var(--lc-text)",
              }}>
              {multiple && (
                <span style={{
                  width: 18, height: 18, borderRadius: 5, flexShrink: 0, fontSize: 12, color: "#fff",
                  border: coche ? "none" : "1.5px solid var(--lc-border)", background: coche ? "var(--sc1)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>{coche ? "✓" : ""}</span>
              )}
              <Avatar id={c.id} nom={c.nom} taille={32} presence={presences?.get(c.id)} />
              <span style={{ minWidth: 0, flex: 1 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.nom}</span>
                <span style={{ display: "block", fontSize: 11, color: "var(--lc-text-muted)" }}>
                  {[c.poste, libellePresence(presences?.get(c.id))].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
