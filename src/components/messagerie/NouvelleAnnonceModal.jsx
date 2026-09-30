import { useMemo, useState } from "react";
import { Btn, Modale } from "../ui";
import { SelecteurComptes } from "./SelecteurComptes";
import { destinatairesAnnonce, postesDeLAnnuaire, PRIORITES } from "./messagerie-logic";
import { champ, puce } from "./styles-messagerie";

const libelle = { display: "block", fontSize: 11, fontWeight: 800, color: "var(--lc-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "12px 0 6px" };

// Rédaction d'une annonce : cibles cumulables, priorité, épinglage et
// accusé de lecture obligatoire. Nombre de destinataires affiché en direct.
export function NouvelleAnnonceModal({ m, fermer }) {
  const [titre, setTitre] = useState("");
  const [corps, setCorps] = useState("");
  const [priorite, setPriorite] = useState("normale");
  const [accuseRequis, setAccuseRequis] = useState(false);
  const [epinglee, setEpinglee] = useState(false);
  const [cible, setCible] = useState({ tous: true, personnel: false, enseignants: false, postes: [], comptes: [] });
  const [choixComptes, setChoixComptes] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const postes = useMemo(() => postesDeLAnnuaire(m.annuaireListe), [m.annuaireListe]);
  const nbDestinataires = destinatairesAnnonce(cible, m.annuaireListe, m.moi).length;

  const basculerGroupe = (cle) => setCible((c) => ({ ...c, tous: cle === "tous" ? !c.tous : false, [cle]: cle === "tous" ? !c.tous : !c[cle] }));
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
      await m.publierAnnonce({ titre, corps, priorite, accuseRequis, epinglee, cible });
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
        <button type="button" style={puce(cible.tous)} onClick={() => basculerGroupe("tous")}>🌍 Tout le monde</button>
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
      {choixComptes && (
        <div style={{ marginTop: 10 }}>
          <SelecteurComptes comptes={m.annuaireListe.filter((c) => c.id !== m.moi)}
            selection={cible.comptes} onBasculer={(id) => basculerListe("comptes", id)} hauteur={200} />
        </div>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: nbDestinataires ? "var(--sc1)" : "#b91c1c", marginTop: 8 }}>
        → {nbDestinataires} destinataire{nbDestinataires > 1 ? "s" : ""}
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

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn disabled={enCours} onClick={publier}>{enCours ? "Publication…" : "📣 Publier"}</Btn>
      </div>
    </Modale>
  );
}
