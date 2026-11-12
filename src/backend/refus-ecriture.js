// Refus DÉFINITIF d'une écriture par le serveur : ce qu'on en garde.
//
// Incident (GS Fatoumata Falilou Diallo, 19/10/2026) : une inscription
// saisie sur l'appareil, puis refusée par le serveur à l'envoi (homonyme sans
// date de naissance), était abandonnée par le connecteur PowerSync et
// disparaissait de l'écran à la synchro suivante, AVEC ses encaissements,
// alors que le reçu avait été remis à la famille. Seul un avertissement de
// quelques secondes l'annonçait sur l'appareil ; l'école ne le voyait nulle
// part. Sept élèves de cette école étaient dans ce cas.
//
// Désormais un refus n'est plus perdu :
//   1. il est écrit dans le journal de l'école (Historique, cloche) avec le
//      motif exact du serveur et la donnée refusée ;
//   2. une inscription ou un encaissement refusé reste affiché sur l'appareil
//      qui l'a saisi (bandeau rouge) jusqu'à ce qu'il soit marqué régularisé.
//
// Sans navigateur ni Supabase : testable sous Node (stockage et cible injectés).

// Pas de trace au journal pour le journal lui-même (boucle) ni pour la
// messagerie et les abonnements push (bruit sans enjeu pour l'école).
export function doitTracerAuJournal(table) {
  const t = String(table || "");
  return !!t && t !== "historique" && t !== "push_subs" && !t.startsWith("msg_");
}

// Indice Postgres technique (identifiant pour l'écran, ex.
// « eleve_avec_encaissements ») : rien à montrer à l'utilisateur.
const INDICE_TECHNIQUE = /^[a-z0-9_]+$/;

// Motif lisible : message du serveur (déjà en français pour les règles
// métier) complété de son indice, ou traduction d'une contrainte technique.
export function motifRefus(err, table) {
  if (table === "paiements" && err?.code === "23503") {
    // i18n-ignore
    return "la fiche de l'élève n'existe pas sur le serveur (inscription refusée ou fiche supprimée).";
  }
  const message = String(err?.message || err || "").trim();
  const indice = String(err?.hint || "").trim();
  if (indice && !INDICE_TECHNIQUE.test(indice) && !message.includes(indice)) return `${message} ${indice}`;
  return message;
}

const nomEleve = (d) => [d?.nom, d?.prenom].map((x) => String(x || "").trim()).filter(Boolean).join(" ");
// Séparateur des milliers de fr-FR (espace fine insécable) → espace simple.
const formatGnf = (n) => Number(n || 0).toLocaleString("fr-FR").replace(/\s/g, " ");

// Libellé d'une ligne du journal de caisse : le mois pour une mensualité,
// sinon le libellé du frais (« Inscription », « Réinscription », …).
export function libellePaiement(d = {}) {
  if (d.type === "mensualite" && d.mois) return String(d.mois);
  return String(d.libelle || d.mois || d.type || "");
}

// Ce que la donnée refusée représente pour l'école.
export function resumeRefus({ table, operation, donnees } = {}) {
  const d = donnees || {};
  if (table === "eleves") {
    const genre = operation === "PUT" ? "inscription" : operation === "DELETE" ? "suppression" : "modification";
    return { genre, eleveId: d.id || "", nom: nomEleve(d), classe: d.classe || "", matricule: d.matricule || "" };
  }
  if (table === "paiements") {
    return {
      genre: operation === "PUT" ? "encaissement" : "modification",
      eleveId: d.eleve_id || "", nom: String(d.eleve_nom || "").trim(), classe: d.classe || "",
      libelle: libellePaiement(d), montant: Number(d.montant) || 0,
    };
  }
  return { genre: "autre" };
}

// Libellés du journal : une donnée de l'école, en français comme les autres lignes.
const ACTIONS = {
  inscription: "Inscription refusée par le serveur", // i18n-ignore
  encaissement: "Encaissement refusé par le serveur", // i18n-ignore
  suppression: "Suppression refusée par le serveur", // i18n-ignore
  modification: "Modification refusée par le serveur", // i18n-ignore
};

// Donnée gardée dans le journal : sans la photo, sans valeur démesurée.
function alleger(donnees) {
  if (!donnees || typeof donnees !== "object") return null;
  const sortie = {};
  for (const [cle, valeur] of Object.entries(donnees)) {
    if (cle === "photo") continue;
    const texte = typeof valeur === "string" ? valeur : JSON.stringify(valeur ?? null);
    if (texte && texte.length > 4000) continue;
    sortie[cle] = valeur;
  }
  return sortie;
}

// Contenu `extra` de la ligne du journal (sans auteur ni date, posés par
// l'appelant). Les textes restent en français : c'est une donnée de l'école,
// comme toutes les lignes du journal.
export function ligneJournalRefus({ table, operation, id = null, donnees = null, motif = "" } = {}) {
  const r = resumeRefus({ table, operation, donnees });
  const classe = r.classe ? ` (${r.classe}${r.matricule ? `, ${r.matricule}` : ""})` : "";
  let action;
  let details;
  if (r.genre === "inscription") {
    action = ACTIONS.inscription;
    // i18n-ignore
    details = `${r.nom || "?"}${classe} — ${motif} L'élève N'EST PAS enregistré, ni ses encaissements : le réinscrire puis réencaisser le reçu.`;
  } else if (r.genre === "encaissement") {
    action = ACTIONS.encaissement;
    details = `${r.nom || "?"} · ${r.libelle} · ${formatGnf(r.montant)} GNF — ${motif}`;
  } else if (r.genre === "autre") {
    action = operation === "DELETE" ? ACTIONS.suppression : ACTIONS.modification;
    details = `${table} — ${motif}`;
  } else {
    action = ACTIONS[r.genre];
    details = `${r.nom || id || "?"}${classe} — ${motif}`;
  }
  return { action, details, refus: { table, operation, id, motif, donnees: alleger(donnees) } };
}

// ── Auteur des traces ────────────────────────────────────────────────────────
// Le connecteur ne connaît pas l'utilisateur : l'application le lui donne
// (use-app-shell), comme pour les autres lignes du journal.
let auteurCourant = "";
export function definirAuteurJournal(nom) { auteurCourant = String(nom || ""); }
export function auteurJournal() { return auteurCourant; }

// ── À régulariser (sur l'appareil qui a saisi) ───────────────────────────────
export const EVENEMENT_A_REGULARISER = "edugest:refus-a-regulariser";
const CLE_A_REGULARISER = "LC_refus_a_regulariser";
const TAILLE_MAX = 200;

export function lireARegulariser(stockage = globalThis.localStorage) {
  try {
    const brut = stockage?.getItem(CLE_A_REGULARISER);
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return [];
  }
}

function ecrire(liste, { stockage, cible }) {
  try {
    stockage?.setItem(CLE_A_REGULARISER, JSON.stringify(liste.slice(0, TAILLE_MAX)));
  } catch { /* stockage plein ou indisponible */ }
  try {
    cible?.dispatchEvent?.(new CustomEvent(EVENEMENT_A_REGULARISER, { detail: liste.length }));
  } catch { /* hors navigateur */ }
}

// `entree` : { id, genre, eleveId, nom, classe, matricule?, libelle?, montant?, motif, le }.
export function ajouterARegulariser(
  entree,
  { stockage = globalThis.localStorage, cible = globalThis.window } = {},
) {
  if (!entree?.id) return lireARegulariser(stockage);
  const liste = [entree, ...lireARegulariser(stockage).filter((e) => e.id !== entree.id)];
  ecrire(liste, { stockage, cible });
  return liste;
}

export function retirerARegulariser(
  ids,
  { stockage = globalThis.localStorage, cible = globalThis.window } = {},
) {
  const aRetirer = new Set(ids || []);
  const liste = lireARegulariser(stockage).filter((e) => !aRetirer.has(e.id));
  ecrire(liste, { stockage, cible });
  return liste;
}

// Un bloc par élève : sa fiche refusée (le cas échéant) et ses encaissements
// refusés dans l'ordre de saisie, avec le total. Les élèves les plus récents
// d'abord (la liste stockée commence par le dernier refus).
export function grouperParEleve(entrees = []) {
  const groupes = new Map();
  for (const e of [...entrees].reverse()) {
    const cle = e.eleveId || `nom:${e.nom}`;
    const g = groupes.get(cle) || {
      cle, nom: e.nom || "", classe: e.classe || "", matricule: e.matricule || "",
      inscription: false, encaissements: [], total: 0, motif: "", ids: [], le: e.le || "",
    };
    g.ids.push(e.id);
    if (e.genre === "inscription") {
      g.inscription = true;
      g.motif = e.motif || g.motif;
      g.nom = e.nom || g.nom;
      g.classe = e.classe || g.classe;
      g.matricule = e.matricule || g.matricule;
    } else if (e.genre === "encaissement") {
      g.encaissements.push({ libelle: e.libelle || "", montant: Number(e.montant) || 0 });
      g.total += Number(e.montant) || 0;
      if (!g.motif) g.motif = e.motif || "";
    }
    if ((e.le || "") > g.le) g.le = e.le;
    groupes.set(cle, g);
  }
  return [...groupes.values()].sort((a, b) => b.le.localeCompare(a.le));
}
