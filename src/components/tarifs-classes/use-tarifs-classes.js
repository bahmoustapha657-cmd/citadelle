import { useState } from "react";
import { CATALOGUE_FRAIS_ANNEXES } from "../../constants";

// Logique de l'éditeur de tarifs par classe : édition locale par classe,
// sauvegarde groupée (Promise.allSettled, conserve les saisies en échec),
// feedback temporaire et total mensuel prévisualisé (base + révision).
// Les frais annexes du catalogue s'éditent via des colonnes "fd:<id>"
// activées par pastilles (visibles si un montant existe quelque part).
export function useTarifsClasses({
  saveTarif, getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc, getTarifFraisDivers,
  toutesClasses = [],
}) {
  const [ouvert, setOuvert] = useState(false);
  // editing: { "Classe X": {mens, revision, autre, ins, reinsc, "fd:uniforme", …} }
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // {type: "success"|"error", msg}
  // Frais du catalogue ajoutés à l'affichage pendant la session d'édition.
  const [fraisAjoutes, setFraisAjoutes] = useState([]);

  // Frais visibles = déjà tarifés quelque part OU ajoutés via pastille.
  const fraisConfigures = new Set();
  for (const classe of toutesClasses) {
    for (const id of Object.keys(getTarifFraisDivers?.(classe) || {})) fraisConfigures.add(id);
  }
  const fraisVisibles = CATALOGUE_FRAIS_ANNEXES
    .filter((f) => f.id !== "autre")
    .filter((f) => fraisConfigures.has(f.id) || fraisAjoutes.includes(f.id));
  const fraisDisponibles = CATALOGUE_FRAIS_ANNEXES
    .filter((f) => f.id !== "autre")
    .filter((f) => !fraisConfigures.has(f.id) && !fraisAjoutes.includes(f.id));
  const ajouterFrais = (id) => setFraisAjoutes((p) => (p.includes(id) ? p : [...p, id]));

  const handleChange = (classe, champ, val) =>
    setEditing(p=>({...p,[classe]:{...(p[classe]||{}), [champ]:val}}));

  // Valeur courante d'un frais divers (édition locale sinon tarif enregistré).
  const getFraisDiversVal = (classe, id) => {
    const cur = editing[classe]?.[`fd:${id}`];
    if (cur !== undefined) return cur;
    return String((getTarifFraisDivers?.(classe) || {})[id] || 0);
  };

  const sauvegarderTout = async () => {
    if (saving) return;
    const entrees = Object.entries(editing);
    if (entrees.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const resultats = await Promise.allSettled(
        entrees.map(([classe, vals]) => {
          // Carte complète des frais divers de la classe : existants + édités.
          const aDesFd = Object.keys(vals).some((k) => k.startsWith("fd:"));
          let fraisDivers = null;
          if (aDesFd) {
            fraisDivers = { ...(getTarifFraisDivers?.(classe) || {}) };
            for (const [k, v] of Object.entries(vals)) {
              if (k.startsWith("fd:")) fraisDivers[k.slice(3)] = Number(v) || 0;
            }
          }
          return saveTarif(
            classe,
            vals.mens!==undefined ? vals.mens : String(getTarifBase(classe)),
            vals.ins!==undefined  ? vals.ins  : String(getTarifIns(classe)),
            vals.reinsc!==undefined ? vals.reinsc : String(getTarifReinsc(classe)),
            vals.revision!==undefined ? vals.revision : String(getTarifRevision(classe)),
            vals.autre!==undefined ? vals.autre : String(getTarifAutre(classe)),
            fraisDivers,
          );
        })
      );
      const echecs = resultats
        .map((r, i) => ({ r, classe: entrees[i][0] }))
        .filter(({ r }) => r.status === "rejected");
      if (echecs.length === 0) {
        setEditing({});
        setFeedback({ type: "success", msg: `✅ ${entrees.length} tarif${entrees.length>1?"s":""} enregistré${entrees.length>1?"s":""}.` });
      } else {
        const restant = {};
        echecs.forEach(({ classe }) => {
          if (editing[classe]) restant[classe] = editing[classe];
        });
        setEditing(restant);
        const premier = echecs[0].r.reason;
        setFeedback({
          type: "error",
          msg: `❌ ${echecs.length} échec${echecs.length>1?"s":""} : ${premier?.message || "écriture refusée"}. Vos saisies sont conservées.`,
        });
      }
    } catch (e) {
      setFeedback({ type: "error", msg: `❌ Erreur inattendue : ${e?.message || "écriture refusée"}.` });
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(null), 5000);
    }
  };

  const modifie = Object.keys(editing).length > 0;

  const getPreviewTotal = (classe) => {
    const base = editing[classe]?.mens!==undefined ? Number(editing[classe].mens || 0) : Number(getTarifBase(classe) || 0);
    const revision = editing[classe]?.revision!==undefined ? Number(editing[classe].revision || 0) : Number(getTarifRevision(classe) || 0);
    return base + revision;
  };

  return {
    ouvert, setOuvert, editing, setEditing, saving, feedback, handleChange,
    sauvegarderTout, modifie, getPreviewTotal,
    fraisVisibles, fraisDisponibles, ajouterFrais, getFraisDiversVal,
  };
}
