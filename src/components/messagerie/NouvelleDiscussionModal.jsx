import { useState } from "react";
import { Btn, Modale } from "../ui";
import { SelecteurComptes } from "./SelecteurComptes";
import { champ, puce } from "./styles-messagerie";

// Nouvelle discussion : message direct (un clic sur un nom) ou groupe nommé.
export function NouvelleDiscussionModal({ m, fermer }) {
  const [mode, setMode] = useState("direct");
  const [titre, setTitre] = useState("");
  const [membres, setMembres] = useState([]);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const comptes = m.annuaireListe.filter((c) => c.id !== m.moi);

  const executer = async (fn) => {
    setEnCours(true);
    setErreur("");
    try { await fn(); fermer(); } catch (e) { setErreur(e.message || "Opération impossible."); } finally { setEnCours(false); }
  };

  const basculer = (id) => setMembres((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));

  return (
    <Modale titre="✍️ Nouvelle discussion" fermer={fermer}>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button type="button" style={{ ...puce(mode === "direct"), flex: 1, padding: "8px" }} onClick={() => setMode("direct")}>💬 Message direct</button>
        <button type="button" style={{ ...puce(mode === "groupe"), flex: 1, padding: "8px" }} onClick={() => setMode("groupe")}>👥 Nouveau groupe</button>
      </div>
      {erreur && <div style={{ background: "#fee2e2", color: "#991b1b", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{erreur}</div>}

      {mode === "direct" ? (
        <SelecteurComptes comptes={comptes} onChoisir={(c) => !enCours && executer(() => m.ouvrirDirecteAvec(c.id))} />
      ) : (
        <>
          <input value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={80}
            placeholder="Nom du groupe (ex. Conseil pédagogique, Comptabilité…)" style={{ ...champ, marginBottom: 10 }} />
          <SelecteurComptes comptes={comptes} selection={membres} onBasculer={basculer} hauteur={260} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <Btn disabled={enCours || !titre.trim() || !membres.length}
              onClick={() => executer(() => m.creerGroupe(titre.trim(), membres))}>
              {enCours ? "Création…" : `Créer le groupe (${membres.length + 1} membres)`}
            </Btn>
          </div>
        </>
      )}
    </Modale>
  );
}
