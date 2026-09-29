// ── Doublons parents : comptes qui semblent appartenir au même parent ──────
// Module PUR (testé par tests/comptes-parents.test.js) pour l'écran
// Comptes & Postes → Doublons parents. Il ne fusionne rien : la Direction
// examine chaque groupe et valide ; l'Edge Function account-manage
// (foyer.ts, fusionnerComptesParents) exécute.
import { normaliserTelGuinee } from "../shared/phone.js";
import { memeParent, nomComparable } from "./comptes-parents";

const actif = (c) => !c.statut || c.statut === "Actif";

// Identité d'un compte : son profil s'il est nommé ; sinon (compte migré,
// anonyme) celle des fiches de ses enfants.
function profils(compte) {
  const x = compte.extra || {};
  const propre = { tuteur: x.tuteur, contactTuteur: compte.telephone || x.contactTuteur, filiation: x.filiation };
  return nomComparable(propre.tuteur) ? [propre] : compte.enfants.map((e) => e.foyer);
}

// Numéros d'un compte : les siens (colonne, profil) ; à défaut, ceux des
// fiches de ses enfants.
function numeros(compte) {
  const propres = [compte.telephone, compte.extra?.contactTuteur].map(normaliserTelGuinee).filter(Boolean);
  const liste = propres.length ? propres : compte.enfants.map((e) => normaliserTelGuinee(e.foyer.contactTuteur)).filter(Boolean);
  return [...new Set(liste)];
}

// Compte à conserver proposé : actif, déjà utilisé par le parent (premiere_co
// levé : il a choisi son mot de passe), celui qui suit le plus d'enfants, le
// plus ancien. La Direction peut en choisir un autre.
function compteConserve(comptes) {
  const rang = (c) => [actif(c) ? 0 : 1, c.premiere_co === false ? 0 : 1, -c.enfants.length];
  return [...comptes].sort((a, b) => {
    const ra = rang(a), rb = rang(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  })[0];
}

// Groupes de comptes parents suspects : même numéro, OU même nom de tuteur et
// même filiation. `comptes` : [{ id, login, nom, telephone, statut,
// premiere_co, created_at, extra }] ; `liens` : [{ compte_id, eleve_id, lien,
// eleves: { prenom, nom, classe, section, tuteur, contact_tuteur, filiation } }].
// Verdict « meme » si tous les comptes du groupe désignent le même parent
// selon la règle du serveur, « a_verifier » sinon (numéro partagé par des
// parents aux noms différents : celui de l'école pour des internes…).
// Les comptes déjà absorbés par une fusion sont ignorés.
export function groupesDoublons(comptes, liens) {
  const enfants = new Map();
  for (const l of liens) {
    const e = l.eleves;
    if (!e) continue;
    enfants.set(l.compte_id, [...(enfants.get(l.compte_id) || []), {
      id: l.eleve_id, prenom: e.prenom || "", nom: e.nom || "", classe: e.classe || "", section: e.section || "",
      lien: l.lien || null, foyer: { tuteur: e.tuteur, contactTuteur: e.contact_tuteur, filiation: e.filiation },
    }]);
  }
  const candidats = comptes
    .filter((c) => !c.extra?.fusionneDans)
    .map((c) => ({ ...c, enfants: enfants.get(c.id) || [] }));

  // Union des comptes qui partagent une clé (numéro, ou nom + filiation).
  const parent = candidats.map((_, i) => i);
  const racine = (i) => (parent[i] === i ? i : (parent[i] = racine(parent[i])));
  const premierPourCle = new Map();
  const raisons = new Map(); // racine → numéro partagé, s'il y en a un
  candidats.forEach((c, i) => {
    const cles = numeros(c).map((n) => `tel:${n}`);
    for (const p of profils(c)) {
      const nom = nomComparable(p.tuteur), filiation = nomComparable(p.filiation);
      if (nom && filiation) cles.push(`foyer:${nom}|${filiation}`);
    }
    for (const cle of cles) {
      if (!premierPourCle.has(cle)) { premierPourCle.set(cle, i); continue; }
      const a = racine(premierPourCle.get(cle)), b = racine(i);
      if (a !== b) parent[b] = a;
      if (cle.startsWith("tel:")) raisons.set(`${i}`, cle.slice(4));
    }
  });

  const parRacine = new Map();
  candidats.forEach((c, i) => parRacine.set(racine(i), [...(parRacine.get(racine(i)) || []), { c, i }]));
  const groupes = [];
  for (const membres of parRacine.values()) {
    if (membres.length < 2) continue;
    const liste = membres.map((m) => m.c).sort((a, b) => a.login.localeCompare(b.login));
    const meme = liste.every((a, i) => liste.slice(i + 1).every((b) =>
      profils(a).some((pa) => profils(b).some((pb) => memeParent(pa, pb)))));
    groupes.push({
      cle: liste.map((c) => c.id).sort().join("+"),
      comptes: liste,
      verdict: meme ? "meme" : "a_verifier",
      telephone: membres.map((m) => raisons.get(`${m.i}`)).find(Boolean) || null,
      cibleId: compteConserve(liste).id,
    });
  }
  return groupes.sort((a, b) => (a.verdict === b.verdict ? 0 : a.verdict === "meme" ? -1 : 1)
    || b.comptes.length - a.comptes.length
    || a.comptes[0].login.localeCompare(b.comptes[0].login));
}
