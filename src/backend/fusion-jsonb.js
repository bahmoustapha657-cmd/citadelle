// ── Fusion des colonnes jsonb (extra / details) EN BASE ──────────────────────
// Une écriture ne renvoie plus tout le jsonb : elle envoie les seuls CHEMINS
// qui ont changé, que la RPC `fusionner_jsonb` applique en une instruction
// (migration 20261109210000_fusion_jsonb). Deux postes qui encaissent chacun
// un mois du même élève ne s'effacent plus : « mens.Oct » et « mens.Nov »
// sont deux chemins distincts.
//
// Opération : { chemin: ["mens", "Oct"], valeur: "Payé" } pose la valeur,
// { chemin: ["mens", "Oct"] } (sans `valeur`) retire la clé.

const estObjet = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

function egaux(a, b) {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((x, i) => egaux(x, b[i]));
  }
  if (!estObjet(a) || !estObjet(b)) return false;
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && egaux(a[k], b[k]));
}

// Différence `avant` → `apres`, objet par objet : seules les feuilles qui
// changent produisent une opération. Un tableau est une feuille (remplacé
// d'un bloc). Clés à `undefined` = absentes (comme JSON.stringify).
export function operationsDiff(avant, apres, chemin = []) {
  const a = estObjet(avant) ? avant : {};
  const b = estObjet(apres) ? apres : {};
  const ops = [];
  for (const k of Object.keys(a)) {
    if (a[k] !== undefined && b[k] === undefined) ops.push({ chemin: [...chemin, k] });
  }
  for (const k of Object.keys(b)) {
    const vb = b[k];
    if (vb === undefined) continue;
    const va = a[k];
    if (estObjet(va) && estObjet(vb)) ops.push(...operationsDiff(va, vb, [...chemin, k]));
    else if (va === undefined || !egaux(va, vb)) ops.push({ chemin: [...chemin, k], valeur: vb });
  }
  return ops;
}

// Champs de premier niveau → opérations (même sens que l'ancienne fusion
// `{ ...actuel, ...champs }` : chaque clé fournie est remplacée telle quelle).
export function operationsChamps(champs) {
  return Object.entries(champs || {})
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({ chemin: [k], valeur: v }));
}

// Miroir JS de jsonb_appliquer_operations (tests, et lecture de contrôle).
export function appliquerOperations(base, ops) {
  const racine = estObjet(base) ? structuredClone(base) : {};
  for (const { chemin, ...op } of ops || []) {
    if (!Array.isArray(chemin) || !chemin.length) continue;
    let noeud = racine;
    for (const k of chemin.slice(0, -1)) {
      if (!estObjet(noeud[k])) {
        if (!("valeur" in op)) { noeud = null; break; }
        noeud[k] = {};
      }
      noeud = noeud[k];
    }
    if (!noeud) continue;
    const fin = chemin.at(-1);
    if ("valeur" in op) noeud[fin] = op.valeur;
    else delete noeud[fin];
  }
  return racine;
}

// Appel de la RPC. Renvoie true si la ligne a été modifiée, false si rien
// (refus RLS, ligne supprimée). Une erreur garde code et statut HTTP (tri
// passager / définitif de la file hors ligne).
export async function fusionnerJsonb(sb, table, id, colonne, operations) {
  const { data, error, status } = await sb.rpc("fusionner_jsonb", {
    p_table: table, p_id: id, p_colonne: colonne, p_operations: operations,
  });
  if (error) throw Object.assign(new Error(error.message), { code: error.code, status });
  return data === true;
}
