import { useEffect, useRef, useState } from "react";
import { fmt } from "../../constants";
import { Btn, Modale } from "../ui";
import {
  lireRetourPaiement, nettoyerRetourPaiement, simulerPaiement, statutPaiement,
} from "../../backend/paiement-en-ligne";

// Délai entre deux vérifications pendant que l'opérateur confirme, et durée
// au-delà de laquelle on rend la main (le paiement continue, l'onglet
// Paiements se mettra à jour tout seul).
const INTERVALLE_MS = 3000;
const ESSAIS = 40;

const MOTIFS = {
  annee: "l'année scolaire a changé entre-temps",
  depasse: "la caisse a déjà encaissé ce que vous vouliez payer",
  cible: "ce que vous payiez n'est plus dû",
  montant: "le montant reçu ne correspond pas",
  conflit_repete: "la fiche était en cours de modification",
  eleve: "la fiche de l'élève a été supprimée",
};

// ══════════════════════════════════════════════════════════════
//  Retour de la page de paiement (et page de simulation)
// ══════════════════════════════════════════════════════════════
// Affiché par le portail quand l'adresse porte ?paiement=<référence> (retour
// de l'opérateur) ou ?paiement-simule=<référence> (fournisseur de
// simulation : tests et démonstrations, aucun argent).
export function RetourPaiement({ onTermine }) {
  // null une fois la fenêtre fermée (le suivi s'arrête avec elle).
  const [retour, setRetour] = useState(() => lireRetourPaiement());
  const [paiement, setPaiement] = useState(null);
  const [erreur, setErreur] = useState("");
  const [attente, setAttente] = useState(!retour?.simulation);
  const essais = useRef(0);

  // Lecture du paiement ; hors simulation, on attend la confirmation de
  // l'opérateur en revérifiant toutes les quelques secondes.
  useEffect(() => {
    if (!retour) return undefined;
    let actif = true;
    let minuteur = null;
    const lire = async () => {
      try {
        const p = await statutPaiement(retour.reference);
        if (!actif) return;
        setPaiement(p);
        if (p.statut === "en_attente" && !retour.simulation && ++essais.current < ESSAIS) {
          minuteur = setTimeout(lire, INTERVALLE_MS);
        } else {
          setAttente(false);
        }
      } catch (e) {
        if (actif) { setErreur(e.message); setAttente(false); }
      }
    };
    lire();
    return () => { actif = false; clearTimeout(minuteur); };
  }, [retour]);

  if (!retour) return null;

  const fermer = () => { nettoyerRetourPaiement(); setRetour(null); onTermine?.(); };
  const simuler = async (resultat) => {
    setAttente(true);
    try { setPaiement(await simulerPaiement(retour.reference, resultat)); } catch (e) { setErreur(e.message); }
    setAttente(false);
  };

  const total = paiement ? paiement.montant + paiement.frais : 0;
  const enSimulation = retour.simulation && paiement?.statut === "en_attente";

  return (
    <Modale titre={enSimulation ? "🧪 Page de paiement simulée" : "💳 Paiement en ligne"} fermer={fermer}>
      {!paiement && !erreur && <p style={{ fontSize: 13 }}>Lecture du paiement…</p>}
      {erreur && <p style={{ fontSize: 13, color: "#b91c1c" }}>{erreur}</p>}

      {paiement && (
        <div style={{ fontSize: 13, lineHeight: 1.6 }}>
          <p style={{ margin: "0 0 10px" }}>
            {paiement.cible?.label} · <strong>{fmt(total)}</strong>
            {paiement.frais > 0 && <span style={{ color: "#64748b" }}> (dont {fmt(paiement.frais)} de frais)</span>}
            <br /><span style={{ fontSize: 11, color: "#94a3b8" }}>Référence {paiement.reference}</span>
          </p>

          {enSimulation && (
            <>
              <p style={{ padding: "10px 12px", borderRadius: 10, background: "#fef3c7", color: "#92400e" }}>
                Simulation : aucun argent ne circule. Choisissez le résultat que l'opérateur renverrait.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Btn v="danger" onClick={() => simuler("echoue")} disabled={attente}>Refuser le paiement</Btn>
                <Btn v="success" onClick={() => simuler("reussi")} disabled={attente}>Confirmer le paiement</Btn>
              </div>
            </>
          )}

          {!retour.simulation && paiement.statut === "en_attente" && (
            <p style={{ padding: "10px 12px", borderRadius: 10, background: "#eff6ff", color: "#1d4ed8" }}>
              {attente
                ? "⏳ En attente de la confirmation de l'opérateur… Validez le paiement sur votre téléphone si ce n'est pas encore fait."
                : "⏳ Toujours en attente. Le paiement se mettra à jour tout seul dès que l'opérateur l'aura confirmé."}
            </p>
          )}

          {paiement.statut === "impute" && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#dcfce7", color: "#166534" }}>
              <strong>✅ Paiement reçu et enregistré.</strong>
              <ul style={{ margin: "6px 0 0", paddingInlineStart: 18 }}>
                {paiement.lignes.map((l, i) => <li key={i}>{l.libelle} : {fmt(l.montant)}</li>)}
              </ul>
            </div>
          )}

          {paiement.statut === "echoue" && (
            <p style={{ padding: "10px 12px", borderRadius: 10, background: "#fee2e2", color: "#b91c1c" }}>
              ❌ Paiement non abouti : rien n'a été prélevé. Vous pouvez réessayer.
            </p>
          )}

          {paiement.statut === "a_verifier" && (
            <p style={{ padding: "10px 12px", borderRadius: 10, background: "#fef3c7", color: "#92400e" }}>
              ⚠️ Paiement reçu, mais il n'a pas pu être enregistré automatiquement
              {paiement.motif && MOTIFS[paiement.motif] ? ` (${MOTIFS[paiement.motif]})` : ""}.
              L'école en est informée et va le régulariser — gardez la référence.
            </p>
          )}
        </div>
      )}

      {paiement?.statut === "regularise" && (
        <p style={{ padding: "10px 12px", borderRadius: 10, background: "#f1f5f9", color: "#334155", fontSize: 13 }}>
          ✅ Paiement reçu et régularisé par l'école.
        </p>
      )}

      {!enSimulation && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <Btn onClick={fermer}>Fermer</Btn>
        </div>
      )}
    </Modale>
  );
}
