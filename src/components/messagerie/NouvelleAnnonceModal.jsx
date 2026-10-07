import { useMemo, useRef, useState } from "react";
import { Btn, Modale } from "../ui";
import { SelecteurComptes } from "./SelecteurComptes";
import {
  classesDesParents, contactables, destinatairesAnnonce, LIBELLES_SECTIONS, postesDeLAnnuaire, PRIORITES,
} from "./messagerie-logic";
import { champ, puce } from "./styles-messagerie";
import { ACCEPT_DOCUMENTS, formatTaille, iconeFichier, MAX_PIECES_ANNONCE, verifierFichier } from "./documents";

const libelle = { display: "block", fontSize: 11, fontWeight: 800, color: "var(--lc-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 6px" };

// Rédaction d'une annonce : cibles cumulables, priorité, épinglage et
// accusé de lecture obligatoire. Nombre de destinataires affiché en direct.
export function NouvelleAnnonceModal({ m, fermer }) {
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [priorite, setPriorite] = useState("normale");
  const [accuseRequis, setAccuseRequis] = useState(false);
  const [epinglee, setEpinglee] = useState(false);
  const [fichiers, setFichiers] = useState([]);
  const choixRef = useRef(null);
  const [cible, setCible] = useState({
    tous: true, personnel: false, enseignants: false, postes: [], comptes: [],
    parents: false, parentsSections: [], parentsClasses: [],
  });
  const [choixComptes, setChoixComptes] = useState(false);
  const [choixClasses, setChoixClasses] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  // Hiérarchie : l'annonce n'atteint que les personnes de son périmètre
  // (la base coupe les cibles de la même façon).
  const perimetre = useMemo(() => contactables(m.annuaireListe, m.moi), [m.annuaireListe, m.moi]);
  const restreint = perimetre.length < m.annuaireListe.filter((c) => c.id !== m.moi).length;
  const postes = useMemo(() => postesDeLAnnuaire(perimetre), [perimetre]);
  const nbDestinataires = destinatairesAnnonce(cible, perimetre, m.moi).length;
  // Parents du périmètre (messagerie-parents.sql) : par section, par classe.
  const classesParents = useMemo(() => classesDesParents(perimetre), [perimetre]);
  const sectionsParents = [...new Set(classesParents.map((c) => c.section))];
  const aDesParents = perimetre.some((c) => c.role === "parent");

  const basculerGroupe = (cle) => setCible((c) => ({ ...c, tous: cle === "tous" ? !c.tous : false, [cle]: cle === "tous" ? !c.tous : !c[cle] }));
  // « Toute l'équipe » ne comprend pas les parents : leurs cibles s'y ajoutent.
  const basculerParents = () => setCible((c) => ({ ...c, parents: !c.parents }));
  const basculerListeParents = (champListe, valeur) => setCible((c) => ({
    ...c, [champListe]: c[champListe].includes(valeur) ? c[champListe].filter((x) => x !== valeur) : [...c[champListe], valeur],
  }));
  const basculerListe = (champListe, valeur) => setCible((c) => ({
    ...c, tous: false,
    [champListe]: c[champListe].includes(valeur) ? c[champListe].filter((x) => x !== valeur) : [...c[champListe], valeur],
  }));

  const publier = async () => {
    setErreur("");
    if (!corps.trim()) { setErreur("Écrivez le texte de l'annonce."); return; }
    if (!nbDestinataires) { setErreur("Choisissez au moins un destinataire."); return; }
    setEnCours(true);
    try {
      await m.publierAnnonce({ titre, corps, priorite, accuseRequis, epinglee, cible, fichiers });
      fermer();
    } catch (e) {
      setErreur(e.message || "Publication impossible.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modale titre="📣 Nouvelle annonce" fermer={fermer} large>
      {erreur && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{erreur}</div>}

      <span style={{ ...libelle, marginTop: 0 }}>Destinataires</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <button type="button" style={puce(cible.tous)} onClick={() => basculerGroupe("tous")}
          title="Personnel et enseignants (pas les parents)">🌍 Toute l'équipe</button>
        <button type="button" style={puce(cible.personnel)} onClick={() => basculerGroupe("personnel")}>🗂️ Personnel administratif</button>
        <button type="button" style={puce(cible.enseignants)} onClick={() => basculerGroupe("enseignants")}>👨‍🏫 Enseignants</button>
        <button type="button" style={puce(choixComptes || cible.comptes.length > 0)} onClick={() => setChoixComptes((v) => !v)}>
          👤 Des personnes{cible.comptes.length ? ` (${cible.comptes.length})` : ""}
        </button>
      </div>
      {postes.size > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
          {[...postes].map(([cle, label]) => (
            <button key={cle} type="button" style={puce(cible.postes.includes(cle))} onClick={() => basculerListe("postes", cle)}>{label}</button>
          ))}
        </div>
      )}
      {aDesParents && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: "var(--lc-text-muted)" }}>Parents :</span>
          <button type="button" style={puce(cible.parents)} onClick={basculerParents}>👪 Tous les parents</button>
          {!cible.parents && sectionsParents.length > 1 && sectionsParents.map((s) => (
            <button key={s} type="button" style={puce(cible.parentsSections.includes(s))}
              onClick={() => basculerListeParents("parentsSections", s)}>
              {LIBELLES_SECTIONS[s] || s}
            </button>
          ))}
          {!cible.parents && classesParents.length > 0 && (
            <button type="button" style={puce(choixClasses || cible.parentsClasses.length > 0)} onClick={() => setChoixClasses((v) => !v)}>
              🏫 Par classe{cible.parentsClasses.length ? ` (${cible.parentsClasses.length})` : "…"}
            </button>
          )}
        </div>
      )}
      {aDesParents && !cible.parents && choixClasses && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8, maxHeight: 150, overflowY: "auto", padding: 8, border: "1px solid var(--lc-border)", borderRadius: 10 }}>
          {classesParents.map((c) => (
            <button key={c.cle} type="button" style={puce(cible.parentsClasses.includes(c.cle))}
              title={`${LIBELLES_SECTIONS[c.section] || c.section} — ${c.parents} parent${c.parents > 1 ? "s" : ""}`}
              onClick={() => basculerListeParents("parentsClasses", c.cle)}>
              {c.classe} <span style={{ opacity: 0.6 }}>({c.parents})</span>
            </button>
          ))}
        </div>
      )}
      {choixComptes && (
        <div style={{ marginTop: 10 }}>
          <SelecteurComptes comptes={perimetre}
            selection={cible.comptes} onBasculer={(id) => basculerListe("comptes", id)} hauteur={200} />
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: nbDestinataires ? "var(--sc1)" : "#b91c1c", marginTop: 8 }}>
        → {nbDestinataires} destinataire{nbDestinataires > 1 ? "s" : ""}
        {restreint && <span style={{ fontWeight: 500, color: "var(--lc-text-muted)" }}> (dans votre périmètre hiérarchique)</span>}
      </div>

      <span style={libelle}>Annonce</span>
      <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={160} placeholder="Titre (ex. Réunion du personnel vendredi 15 h)" style={{ ...champ, marginBottom: 8 }} />
      <textarea value={corps} onChange={(e) => setCorps(e.target.value)} maxLength={8000} rows={6} placeholder="Texte de l'annonce…"
        style={{ ...champ, resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }} />

      <span style={libelle}>Importance</span>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {Object.entries(PRIORITES).map(([cle, p]) => (
          <button key={cle} type="button" onClick={() => setPriorite(cle)}
            style={{ ...puce(priorite === cle), ...(priorite === cle ? { borderColor: p.couleur, color: p.couleur, background: p.fond } : {}) }}>
            {p.icone} {p.libelle}
          </button>
        ))}
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, fontSize: 13, color: "var(--lc-text)", cursor: "pointer" }}>
        <input type="checkbox" checked={accuseRequis} onChange={(e) => setAccuseRequis(e.target.checked)} />
        ✅ Accusé de lecture obligatoire <span style={{ fontSize: 11.5, color: "var(--lc-text-muted)" }}>(chacun doit confirmer « J'ai lu et compris »)</span>
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 13, color: "var(--lc-text)", cursor: "pointer" }}>
        <input type="checkbox" checked={epinglee} onChange={(e) => setEpinglee(e.target.checked)} />
        📌 Épingler en tête des annonces
      </label>

      <span style={libelle}>Pièces jointes <span style={{ textTransform: "none", fontWeight: 500 }}>({MAX_PIECES_ANNONCE} max, 10 Mo chacune)</span></span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        {fichiers.map((f, i) => {
          const verif = verifierFichier(f);
          return (
            <span key={`${f.name}-${i}`} title={verif.ok ? "" : verif.erreur}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 260, background: "var(--lc-surface-alt)", border: `1px solid ${verif.ok ? "var(--lc-border)" : "#f87171"}`, borderRadius: 14, padding: "3px 6px 3px 10px", fontSize: 12, color: "var(--lc-text)" }}>
              {iconeFichier(verif.type)}
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
              <span style={{ color: verif.ok ? "var(--lc-text-faint)" : "#b91c1c" }}>{verif.ok ? formatTaille(f.size) : "refusé"}</span>
              <button type="button" onClick={() => setFichiers((l) => l.filter((_, j) => j !== i))} aria-label={`Retirer ${f.name}`}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--lc-text-muted)" }}>✕</button>
            </span>
          );
        })}
        {fichiers.length < MAX_PIECES_ANNONCE && (
          <button type="button" style={puce(false)} onClick={() => choixRef.current?.click()}>📎 Joindre un document</button>
        )}
        <input ref={choixRef} type="file" multiple accept={ACCEPT_DOCUMENTS} style={{ display: "none" }}
          onChange={(e) => { const choisis = Array.from(e.target.files || []); setFichiers((l) => [...l, ...choisis].slice(0, MAX_PIECES_ANNONCE)); e.target.value = ""; }} />
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn disabled={enCours} onClick={publier}>{enCours ? (fichiers.length ? "Envoi des pièces jointes…" : "Publication…") : "📣 Publier"}</Btn>
      </div>
    </Modale>
  );
}
