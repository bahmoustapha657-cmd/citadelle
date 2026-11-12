// Garde d'une écriture que le serveur REFUSE définitivement, avant que le
// connecteur ne l'abandonne (cf. connector.js et refus-ecriture.js).
//
// Isolé de connector.js pour être testé sans @powersync/web : `database` n'a
// besoin que de getOptional(sql, params) et execute(sql, params).
import { parseJsonCols, stringifyJsonCols } from "./tables.js";
import {
  ajouterARegulariser, auteurJournal, doitTracerAuJournal, ligneJournalRefus, motifRefus, resumeRefus,
} from "../refus-ecriture.js";

// Fiches élèves dont l'INSCRIPTION vient d'être refusée : leurs modifications
// suivantes (mois cochés à l'encaissement…) sont refusées par voie de
// conséquence — inutile de les annoncer une seconde fois. Leurs
// encaissements, eux, restent tracés un par un : c'est de l'argent.
const inscriptionsRefusees = new Set();

// La donnée telle que l'utilisateur l'a saisie : la ligne envoyée (ajout), la
// ligne du miroir complétée de la modification, ou ses valeurs d'avant
// (suppression : la ligne n'est plus dans le miroir).
async function donneesSaisies(database, op) {
  if (op.op === "PUT") return parseJsonCols(op.table, { ...op.opData, id: op.id });
  if (op.op === "PATCH") {
    const locale = await database.getOptional(`SELECT * FROM ${op.table} WHERE id = ?`, [op.id]).catch(() => null);
    return parseJsonCols(op.table, { ...(locale || {}), ...(op.opData || {}), id: op.id });
  }
  return op.previousValues ? parseJsonCols(op.table, { ...op.previousValues, id: op.id }) : { id: op.id };
}

async function ecoleDe(database, donnees) {
  if (donnees?.ecole_id) return donnees.ecole_id;
  const ecole = await database.getOptional("SELECT id FROM ecoles LIMIT 1", []).catch(() => null);
  return ecole?.id || null;
}

// Renvoie le motif lisible du refus. Ne lève jamais : la garde ne doit pas
// empêcher le connecteur d'abandonner l'écriture (la file resterait bloquée).
export async function garderRefus(database, op, err, options = {}) {
  const motif = motifRefus(err, op?.table);
  if (!op?.table) return motif;
  try {
    const donnees = await donneesSaisies(database, op);
    if (op.table === "eleves") {
      if (op.op === "PUT") inscriptionsRefusees.add(op.id);
      else if (inscriptionsRefusees.has(op.id)) return motif;
    }

    const resume = resumeRefus({ table: op.table, operation: op.op, donnees });
    if (resume.genre === "inscription" || resume.genre === "encaissement") {
      ajouterARegulariser({ id: op.id, ...resume, motif, le: new Date().toISOString() }, options);
    }

    const ecoleId = doitTracerAuJournal(op.table) ? await ecoleDe(database, donnees) : null;
    if (ecoleId) {
      const ligne = ligneJournalRefus({ table: op.table, operation: op.op, id: op.id, donnees, motif });
      // Ligne du journal mise en file comme les autres (ajout seul) : elle
      // part au prochain envoi, et suit les mêmes règles s'il échoue.
      const { extra } = stringifyJsonCols("historique", {
        extra: { ...ligne, auteur: auteurJournal(), date: Date.now() },
      });
      await database.execute(
        "INSERT INTO historique (id, ecole_id, extra) VALUES (?, ?, ?)",
        [globalThis.crypto.randomUUID(), ecoleId, extra],
      );
    }
  } catch (e) {
    console.warn("[powersync] refus non gardé :", e?.message || e);
  }
  return motif;
}

// Tests : repartir d'un état vierge.
export function _reinitialiserGardeRefus() { inscriptionsRefusees.clear(); }
