import { useEffect, useState } from "react";
import { changerEspace, mesEspaces } from "../../backend/espaces-supabase";
import { libelleEspace } from "../../espaces-comptes";
import { choixDemande, oublierChoix } from "./espaces-choix";

// Une personne, plusieurs espaces (enseignant + parent + personnel…) : si le
// compte connecté est relié à d'autres comptes (Comptes & Postes →
// « Relier »), un bouton « Espace » permet de passer de l'un à l'autre sans
// se déconnecter. Juste après une connexion par le formulaire, le choix est
// proposé d'office. Rien ne s'affiche pour un compte non relié.
// Affiché par App au-dessus des trois interfaces (personnel, portails
// enseignant et parent), qui n'ont rien à savoir de ces espaces.

export function EspacesUtilisateur({ utilisateur }) {
  const uid = utilisateur?.uid || null;
  const bloque = !uid || utilisateur?.premiereCo;
  // Espaces lus pour un uid donné : un autre compte n'hérite pas de la liste.
  const [lus, setLus] = useState({ uid: null, liste: [] });
  const espaces = lus.uid === uid ? lus.liste : [];
  const [ouvert, setOuvert] = useState(false);
  const [enCours, setEnCours] = useState(null);
  const [erreur, setErreur] = useState("");

  useEffect(() => {
    let actif = true;
    if (bloque) return undefined;
    mesEspaces().then((liste) => {
      if (!actif) return;
      setLus({ uid, liste });
      if (liste.length > 1 && choixDemande()) setOuvert(true);
      oublierChoix();
    }).catch(() => {});
    return () => { actif = false; };
  }, [uid, bloque]);

  if (bloque || espaces.length < 2) return null;
  const actuel = espaces.find((e) => e.actuel) || espaces[0];
  const a = libelleEspace(actuel);

  const choisir = async (e) => {
    if (e.actuel) { setOuvert(false); return; }
    setErreur("");
    setEnCours(e.id);
    try {
      await changerEspace(e.id, utilisateur.schoolId);
      // Rechargement : l'app repart proprement sur le nouvel espace (page,
      // synchro hors ligne, données), comme après une connexion.
      window.location.reload();
    } catch (err) {
      setErreur(err.message || "Changement d'espace impossible.");
      setEnCours(null);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} title="Changer d'espace" style={{
        position: "fixed", left: 12, bottom: 12, zIndex: 900, display: "flex", alignItems: "center", gap: 6,
        border: "1px solid #c7d2fe", background: "#eef2ff", color: "#3730a3", borderRadius: 999,
        padding: "7px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer", boxShadow: "0 2px 8px rgba(15,23,42,.15)",
      }}>
        <span>{a.icone}</span><span>{a.titre}</span><span style={{ opacity: 0.7 }}>⇄</span>
      </button>
      {ouvert && (
        <div role="dialog" aria-modal="true" aria-label="Choisir mon espace" onClick={() => !enCours && setOuvert(false)} style={{
          position: "fixed", inset: 0, zIndex: 1000, background: "rgba(15,23,42,.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        }}>
          <div onClick={(ev) => ev.stopPropagation()} style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, padding: 20, boxShadow: "0 20px 50px rgba(15,23,42,.3)" }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: "#0f172a" }}>Choisissez votre espace</div>
            <div style={{ fontSize: 12, color: "#64748b", margin: "4px 0 14px" }}>{actuel.nom} — vous pourrez en changer à tout moment avec le bouton en bas à gauche.</div>
            <div style={{ display: "grid", gap: 8 }}>
              {espaces.map((e) => {
                const l = libelleEspace(e);
                return (
                  <button key={e.id} type="button" disabled={Boolean(enCours)} onClick={() => choisir(e)} style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "start", padding: "12px 14px", borderRadius: 12, cursor: enCours ? "wait" : "pointer",
                    border: `2px solid ${e.actuel ? "#6366f1" : "#e2e8f0"}`, background: e.actuel ? "#eef2ff" : "#fff",
                  }}>
                    <span style={{ fontSize: 24 }}>{l.icone}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: "block", fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{l.titre}</span>
                      <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                        {enCours === e.id ? "Ouverture…" : e.actuel ? "Espace actuel" : "Ouvrir cet espace"}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {erreur && <div style={{ marginTop: 12, fontSize: 12, color: "#b91c1c" }}>{erreur}</div>}
          </div>
        </div>
      )}
    </>
  );
}
