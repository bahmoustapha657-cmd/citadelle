import React, { useContext, useEffect, useState } from "react";
import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../firebaseDb";
import { SchoolContext } from "../contexts/SchoolContext";
import { getPeriodesForSchool } from "../period-utils";
import { C } from "../constants";
import { Btn, Modale, Selec } from "./ui";

const NOTES_COLLECTIONS = ["notesCollege", "notesPrimaire", "notesLycee"];
const BATCH_LIMIT = 450; // marge sous la limite Firestore de 500

// Scanne les 3 collections de notes et retourne les périodes orphelines
// (présentes en base mais hors de la périodicité actuelle de l'école).
async function collecterPeriodesOrphelines(schoolId, periodesActuelles) {
  const set = new Set(periodesActuelles);
  const compteur = new Map(); // periode -> nombre de notes
  for (const col of NOTES_COLLECTIONS) {
    const snap = await getDocs(collection(db, "ecoles", schoolId, col));
    snap.forEach((d) => {
      const p = d.data().periode;
      if (!p || set.has(p)) return;
      compteur.set(p, (compteur.get(p) || 0) + 1);
    });
  }
  return [...compteur.entries()].map(([periode, count]) => ({ periode, count }));
}

// Applique le mapping : periode orpheline -> nouvelle (ou "_delete_")
async function appliquerMapping(schoolId, mapping) {
  let totalMaj = 0;
  let totalSup = 0;
  for (const col of NOTES_COLLECTIONS) {
    const snap = await getDocs(collection(db, "ecoles", schoolId, col));
    let batch = writeBatch(db);
    let ops = 0;
    for (const d of snap.docs) {
      const p = d.data().periode;
      if (!p || !(p in mapping)) continue;
      const cible = mapping[p];
      const ref = doc(db, "ecoles", schoolId, col, d.id);
      if (cible === "_delete_") {
        batch.delete(ref);
        totalSup++;
      } else {
        batch.update(ref, { periode: cible });
        totalMaj++;
      }
      ops++;
      if (ops >= BATCH_LIMIT) {
        await batch.commit();
        batch = writeBatch(db);
        ops = 0;
      }
    }
    if (ops > 0) await batch.commit();
  }
  return { totalMaj, totalSup };
}

export function MigrationPeriodesModal({ fermer }) {
  const { schoolId, schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const periodesActuelles = getPeriodesForSchool(schoolInfo, moisAnnee);
  const [chargement, setChargement] = useState(true);
  const [orphelines, setOrphelines] = useState([]);
  const [mapping, setMapping] = useState({}); // { ancienne: nouvelleOuDelete }
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    let annule = false;
    (async () => {
      try {
        const liste = await collecterPeriodesOrphelines(schoolId, periodesActuelles);
        if (annule) return;
        setOrphelines(liste);
        const initial = {};
        liste.forEach((o) => { initial[o.periode] = periodesActuelles[0] || "_delete_"; });
        setMapping(initial);
      } catch (e) {
        toast("Erreur lors du scan des notes : " + (e.message || e), "danger");
      } finally {
        if (!annule) setChargement(false);
      }
    })();
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  const lancer = async () => {
    if (!Object.keys(mapping).length) return;
    if (!confirm("Confirmer la migration ? Cette opération modifiera vos notes en base et est irréversible.")) return;
    setEnCours(true);
    try {
      const { totalMaj, totalSup } = await appliquerMapping(schoolId, mapping);
      toast(`Migration effectuée : ${totalMaj} note(s) mise(s) à jour, ${totalSup} supprimée(s).`, "success");
      fermer();
    } catch (e) {
      toast("Échec migration : " + (e.message || e), "danger");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modale titre="🔁 Migration des notes — périodes orphelines" fermer={fermer}>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#475569" }}>
        Périodicité actuelle de l'école : <strong style={{ color: C.blue }}>{periodesActuelles.join(" · ")}</strong>
      </p>

      {chargement && <p style={{ fontSize: 12, color: "#64748b" }}>Analyse des notes en cours…</p>}

      {!chargement && orphelines.length === 0 && (
        <p style={{ padding: "12px 14px", background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, fontSize: 12, color: "#15803d" }}>
          ✅ Aucune note orpheline détectée. Toutes les notes utilisent une période valide pour la périodicité actuelle.
        </p>
      )}

      {!chargement && orphelines.length > 0 && (
        <>
          <p style={{ margin: "8px 0", fontSize: 12, color: "#92400e", padding: "8px 12px", background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 6 }}>
            ⚠️ {orphelines.length} période(s) orpheline(s) détectée(s). Pour chacune, choisissez une période actuelle de destination ou la suppression.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {orphelines.map((o) => (
              <div key={o.periode} style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, alignItems: "center", padding: "10px 12px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: C.blueDark }}>{o.periode}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{o.count} note(s)</div>
                </div>
                <Selec
                  label="Migrer vers"
                  value={mapping[o.periode] || ""}
                  onChange={(e) => setMapping((m) => ({ ...m, [o.periode]: e.target.value }))}
                >
                  {periodesActuelles.map((p) => <option key={p} value={p}>{p}</option>)}
                  <option value="_delete_">🗑️ Supprimer ces notes</option>
                </Selec>
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
        <Btn v="ghost" onClick={fermer} disabled={enCours}>Fermer</Btn>
        {orphelines.length > 0 && (
          <Btn v="success" onClick={lancer} disabled={enCours || chargement}>
            {enCours ? "Migration en cours…" : "Appliquer la migration"}
          </Btn>
        )}
      </div>
    </Modale>
  );
}
