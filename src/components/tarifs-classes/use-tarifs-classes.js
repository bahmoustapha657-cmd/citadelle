import { useState } from "react";

// Logique de l'éditeur de tarifs par classe : édition locale par classe,
// sauvegarde groupée (Promise.allSettled, conserve les saisies en échec),
// feedback temporaire et total mensuel prévisualisé (base + révision).
export function useTarifsClasses({
  saveTarif, getTarifBase, getTarifRevision, getTarifAutre, getTarifIns, getTarifReinsc,
}) {
  const [ouvert, setOuvert] = useState(false);
  // editing: { "Classe X": {mens, revision, autre, ins, reinsc} }
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // {type: "success"|"error", msg}

  const handleChange = (classe, champ, val) =>
    setEditing(p=>({...p,[classe]:{...(p[classe]||{}), [champ]:val}}));

  const sauvegarderTout = async () => {
    if (saving) return;
    const entrees = Object.entries(editing);
    if (entrees.length === 0) return;
    setSaving(true);
    setFeedback(null);
    try {
      const resultats = await Promise.allSettled(
        entrees.map(([classe, vals]) =>
          saveTarif(
            classe,
            vals.mens!==undefined ? vals.mens : String(getTarifBase(classe)),
            vals.ins!==undefined  ? vals.ins  : String(getTarifIns(classe)),
            vals.reinsc!==undefined ? vals.reinsc : String(getTarifReinsc(classe)),
            vals.revision!==undefined ? vals.revision : String(getTarifRevision(classe)),
            vals.autre!==undefined ? vals.autre : String(getTarifAutre(classe))
          )
        )
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

  return { ouvert, setOuvert, editing, setEditing, saving, feedback, handleChange, sauvegarderTout, modifie, getPreviewTotal };
}
