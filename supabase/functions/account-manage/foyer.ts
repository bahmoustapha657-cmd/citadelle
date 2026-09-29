// ════════════════════════════════════════════════════════════════════════
//  account-manage — comptes parents : un foyer, un compte
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (comme droits.ts) : index.ts l'importe avec son
// client service_role, et les tests Node (tests/comptes-parents.test.js) le
// chargent tel quel avec un faux client.
//
// Un parent a UN compte pour tous ses enfants, quelle que soit leur section.
// Avant d'en créer un, on cherche le sien parmi les comptes parents de
// l'école : les élèves y sont alors seulement rattachés (parent_eleves), mot
// de passe inchangé. L'API Firebase le faisait (api/_lib/account-links.js,
// hasSameParentHousehold) ; l'Edge Function l'avait perdu. Un enfant peut
// aussi être suivi par plusieurs comptes — le père et la mère chacun le sien.
//
// parent_eleves fait foi : extra.eleveIds n'est qu'un reliquat (identifiants
// Firebase pour les comptes migrés), jamais lu ici.
import { normaliserTel } from "../_shared/telephone.ts";

export type Foyer = { tuteur?: unknown; contactTuteur?: unknown; filiation?: unknown };

export type CompteParent = {
  id: string;
  login: string;
  statut?: string | null;
  premiere_co?: boolean | null;
  created_at?: string | null;
  telephone?: string | null;
  extra?: Record<string, unknown> | null;
  profil: Foyer; // le parent titulaire du compte (extra + telephone)
  foyersEnfants: Foyer[]; // fiches des enfants rattachés
  eleveIds: string[]; // enfants rattachés (parent_eleves)
};

// Lien de parenté d'un rattachement (contrainte parent_eleves_lien_check).
const LIENS = new Set(["pere", "mere", "tuteur", "autre"]);
export const lienValide = (lien: unknown): string | null => (LIENS.has(String(lien)) ? String(lien) : null);

// Nom comparable : sans casse, accents ni ponctuation, mots dans l'ordre
// alphabétique — « DIALLO Mamadou » et « Mamadou Diallo » se rejoignent.
export function nomComparable(brut: unknown): string {
  return String(brut ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).sort().join(" ");
}

// Même parent ? Le tuteur doit être nommé, et de la même façon, des deux
// côtés. Ensuite :
//   • deux numéros lisibles : ils doivent être identiques ;
//   • sinon, la filiation doit être renseignée et identique.
// Un numéro seul ne suffit jamais : le même sert parfois à plusieurs familles
// (celui de l'école, saisi pour des internes). Dans le doute, pas de
// rattachement : un compte en double se corrige, un enfant montré à une
// autre famille non.
export function memeFoyer(a: Foyer, b: Foyer): boolean {
  const nom = nomComparable(a.tuteur);
  if (!nom || nom !== nomComparable(b.tuteur)) return false;
  const telA = normaliserTel(a.contactTuteur);
  const telB = normaliserTel(b.contactTuteur);
  if (telA && telB) return telA === telB;
  const filiation = nomComparable(a.filiation);
  return Boolean(filiation) && filiation === nomComparable(b.filiation);
}

const actif = (c: CompteParent) => !c.statut || c.statut === "Actif";
const profilConnu = (c: CompteParent) => Boolean(nomComparable(c.profil.tuteur));

// Compte du parent `candidat` parmi les comptes parents de l'école, ou null.
//   • Parent nommé : SON compte, reconnu à son profil — ou, pour un compte
//     anonyme (compte migré sans profil), à la fiche d'un enfant qu'il suit.
//     Un compte au profil d'un AUTRE parent ne lui est jamais attribué, même
//     s'il suit les mêmes enfants : c'est le compte de la mère, pas du père.
//   • Parent inconnu (fiche sans nom de tuteur) : le compte qui suit déjà un
//     de ces élèves, plutôt qu'un doublon.
// Plusieurs candidats (doublons déjà créés) : profil reconnu d'abord, puis
// celui qui suit déjà un des élèves, un compte actif, en service
// (premiere_co levé : le parent a choisi son mot de passe), le plus ancien.
export function trouverCompteFoyer(comptes: CompteParent[], candidat: Foyer, eleveIds: string[]): CompteParent | null {
  const vises = new Set(eleveIds);
  const suitUnEleve = (c: CompteParent) => c.eleveIds.some((id) => vises.has(id));
  const parProfil = (c: CompteParent) => memeFoyer(candidat, c.profil);
  const nomme = Boolean(nomComparable(candidat.tuteur));
  const trouves = comptes.filter((c) => (nomme
    ? parProfil(c) || (!profilConnu(c) && c.foyersEnfants.some((f) => memeFoyer(candidat, f)))
    : suitUnEleve(c)));
  const rang = (c: CompteParent) =>
    [parProfil(c) ? 0 : 1, suitUnEleve(c) ? 0 : 1, actif(c) ? 0 : 1, c.premiere_co === false ? 0 : 1];
  trouves.sort((a, b) => {
    const ra = rang(a), rb = rang(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
  return trouves[0] || null;
}

// ── Accès base (client service_role injecté) ───────────────────────────────
// deno-lint-ignore no-explicit-any
type Client = { from: (table: string) => any };

// PostgREST plafonne chaque réponse à 1000 lignes : lecture par pages, triées
// pour qu'elles ne se chevauchent pas.
const PAGE = 1000;
// deno-lint-ignore no-explicit-any
async function lireTout(construire: () => any): Promise<Record<string, unknown>[]> {
  const lignes: Record<string, unknown>[] = [];
  for (let de = 0; ; de += PAGE) {
    const { data, error } = await construire().range(de, de + PAGE - 1);
    if (error) throw new Error(error.message);
    lignes.push(...(data || []));
    if (!data || data.length < PAGE) return lignes;
  }
}

const foyerEleve = (e: Record<string, unknown> | null | undefined): Foyer =>
  ({ tuteur: e?.tuteur, contactTuteur: e?.contact_tuteur, filiation: e?.filiation });

// Comptes parents de l'école, chacun avec ses enfants, son profil et celui de
// la fiche de chaque enfant rattaché.
export async function chargerComptesParents(admin: Client, ecoleId: string): Promise<CompteParent[]> {
  const comptes = await lireTout(() => admin.from("comptes")
    .select("id, login, statut, premiere_co, created_at, telephone, extra")
    .eq("ecole_id", ecoleId).eq("role", "parent").order("id"));
  const liens = await lireTout(() => admin.from("parent_eleves")
    .select("compte_id, eleve_id, eleves!inner(ecole_id, tuteur, contact_tuteur, filiation)")
    .eq("eleves.ecole_id", ecoleId).order("compte_id").order("eleve_id"));

  const parCompte = new Map<string, CompteParent>();
  for (const c of comptes) {
    const extra = (c.extra || {}) as Record<string, unknown>;
    parCompte.set(String(c.id), {
      id: String(c.id), login: String(c.login), statut: c.statut as string | null,
      premiere_co: c.premiere_co as boolean | null, created_at: c.created_at as string | null,
      telephone: c.telephone as string | null, extra,
      profil: { tuteur: extra.tuteur, contactTuteur: c.telephone || extra.contactTuteur, filiation: extra.filiation },
      foyersEnfants: [],
      eleveIds: [],
    });
  }
  for (const l of liens) {
    const compte = parCompte.get(String(l.compte_id));
    if (!compte) continue;
    compte.eleveIds.push(String(l.eleve_id));
    compte.foyersEnfants.push(foyerEleve(l.eleves as Record<string, unknown>));
  }
  return [...parCompte.values()];
}

// Rattache les élèves au compte de leur parent s'il existe. Renvoie :
//   • { status, error } : élève absent de l'école (ou pas encore synchronisé) ;
//   • { compte, rattaches } : élèves rattachés au compte existant (rattaches =
//     nombre de NOUVEAUX liens, 0 si tous l'étaient déjà) ;
//   • null : pas de compte pour ce parent — à l'appelant de le créer.
// `lien` : lien de parenté des nouveaux rattachements (père, mère…).
export async function rattacherAuFoyer(
  admin: Client,
  { ecoleId, eleveIds: demandes, foyer, lien = null }:
    { ecoleId: string; eleveIds: string[]; foyer: Foyer; lien?: unknown },
): Promise<{ status: number; error: string } | { compte: CompteParent; rattaches: number } | null> {
  const eleveIds = [...new Set(demandes.map(String).filter(Boolean))];
  const { data: eleves, error } = await admin.from("eleves")
    .select("id").eq("ecole_id", ecoleId).in("id", eleveIds);
  if (error) throw new Error(error.message);
  if ((eleves || []).length !== eleveIds.length) {
    return {
      status: 409,
      error: "Élève introuvable dans cette école. S'il vient d'être inscrit, réessayez dans un instant (synchronisation en cours).",
    };
  }

  const compte = trouverCompteFoyer(await chargerComptesParents(admin, ecoleId), foyer, eleveIds);
  if (!compte) return null;

  const nouveaux = eleveIds.filter((id) => !compte.eleveIds.includes(id));
  if (nouveaux.length) {
    const { error: lienErr } = await admin.from("parent_eleves").upsert(
      nouveaux.map((eid) => ({ compte_id: compte.id, eleve_id: eid, lien: lienValide(lien) })),
      { onConflict: "compte_id,eleve_id" },
    );
    if (lienErr) throw new Error(lienErr.message);
  }

  // Compte reconnu à son profil (c'est bien ce parent) : on complète ce qui
  // lui manque, sans rien écraser. Reconnu seulement par la fiche d'un
  // enfant : on n'y inscrit pas une identité déduite.
  if (memeFoyer(foyer, compte.profil)) {
    const extra = compte.extra || {};
    const maj: Record<string, unknown> = {};
    const complements: Record<string, unknown> = {};
    for (const cle of ["tuteur", "contactTuteur", "filiation"] as const) {
      if (!String(extra[cle] ?? "").trim() && String(foyer[cle] ?? "").trim()) complements[cle] = foyer[cle];
    }
    if (Object.keys(complements).length) maj.extra = { ...extra, ...complements };
    const tel = normaliserTel(foyer.contactTuteur);
    if (!compte.telephone && tel) maj.telephone = tel;
    if (Object.keys(maj).length) await admin.from("comptes").update(maj).eq("id", compte.id);
  }

  return { compte, rattaches: nouveaux.length };
}

// Rattache (ou détache) UN élève à UN compte parent existant, après avoir
// vérifié que tous deux sont de l'école de l'appelant. Renvoie { login } ou
// { status, error }.
export async function modifierLienParent(
  admin: Client,
  { ecoleId, compteId, eleveId, lien = null, rattacher }:
    { ecoleId: string; compteId: string; eleveId: string; lien?: unknown; rattacher: boolean },
): Promise<{ login: string } | { status: number; error: string }> {
  const { data: compte, error } = await admin.from("comptes")
    .select("id, login, role, ecole_id").eq("id", compteId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!compte || compte.ecole_id !== ecoleId || compte.role !== "parent") {
    return { status: 404, error: "Compte parent introuvable dans cette école." };
  }
  const { data: eleve, error: eleveErr } = await admin.from("eleves")
    .select("id").eq("id", eleveId).eq("ecole_id", ecoleId).maybeSingle();
  if (eleveErr) throw new Error(eleveErr.message);
  if (!eleve) return { status: 404, error: "Élève introuvable dans cette école." };

  const { error: ecritErr } = rattacher
    // Sans lien précisé, un rattachement existant garde le sien.
    ? await admin.from("parent_eleves").upsert(
      { compte_id: compteId, eleve_id: eleveId, lien: lienValide(lien) },
      { onConflict: "compte_id,eleve_id", ignoreDuplicates: !lienValide(lien) },
    )
    : await admin.from("parent_eleves").delete().eq("compte_id", compteId).eq("eleve_id", eleveId);
  if (ecritErr) throw new Error(ecritErr.message);
  return { login: String(compte.login) };
}

// Fusion de comptes parents en double, validée par la Direction : les enfants
// des comptes `sourceIds` passent au compte conservé `cibleId`, qui garde son
// identifiant et son mot de passe ; les comptes absorbés sont désactivés
// (statut Inactif, extra.fusionneDans) — l'appelant bloque aussi leur
// connexion. Pas de transaction d'un bout à l'autre : chaque étape est
// rejouable, une fusion interrompue se termine en la relançant.
// Renvoie { cible, absorbes, liensDeplaces } ou { status, error }.
export async function fusionnerComptesParents(
  admin: Client,
  { ecoleId, cibleId, sourceIds: demandes }: { ecoleId: string; cibleId: string; sourceIds: unknown[] },
): Promise<
  | { cible: { id: string; login: string }; absorbes: { id: string; login: string; user_id: string | null }[]; liensDeplaces: number }
  | { status: number; error: string }
> {
  const sourceIds = [...new Set(demandes.map(String).filter((id) => id && id !== cibleId))];
  if (!cibleId || !sourceIds.length) {
    return { status: 400, error: "Choisissez le compte conservé et au moins un compte à fusionner." };
  }
  const ids = [cibleId, ...sourceIds];
  const { data: trouves, error } = await admin.from("comptes")
    .select("id, login, role, ecole_id, statut, telephone, user_id, extra").in("id", ids);
  if (error) throw new Error(error.message);
  const parId = new Map<string, Record<string, unknown>>((trouves || []).map((c: Record<string, unknown>) => [String(c.id), c]));
  const horsEcole = ids.some((id) => {
    const c = parId.get(id);
    return !c || c.ecole_id !== ecoleId || c.role !== "parent";
  });
  if (horsEcole) return { status: 404, error: "Compte parent introuvable dans cette école." };
  const cible = parId.get(cibleId)!;
  const extraCible = (cible.extra || {}) as Record<string, unknown>;
  if ((cible.statut && cible.statut !== "Actif") || extraCible.fusionneDans) {
    return { status: 409, error: "Le compte conservé doit être un compte actif." };
  }
  const sources = sourceIds.map((id) => parId.get(id)!);

  // 1. Les enfants des comptes absorbés passent au compte conservé ; un enfant
  //    qu'il suit déjà garde son lien.
  const { data: liens, error: liensErr } = await admin.from("parent_eleves")
    .select("compte_id, eleve_id, lien").in("compte_id", ids);
  if (liensErr) throw new Error(liensErr.message);
  const suivis = new Set((liens || []).filter((l: Record<string, unknown>) => l.compte_id === cibleId).map((l: Record<string, unknown>) => l.eleve_id));
  const aDeplacer = new Map<unknown, { compte_id: string; eleve_id: unknown; lien: string | null }>();
  for (const l of (liens || []) as Record<string, unknown>[]) {
    if (l.compte_id === cibleId || suivis.has(l.eleve_id)) continue;
    const deja = aDeplacer.get(l.eleve_id);
    if (!deja || (!deja.lien && lienValide(l.lien))) {
      aDeplacer.set(l.eleve_id, { compte_id: cibleId, eleve_id: l.eleve_id, lien: lienValide(l.lien) });
    }
  }
  if (aDeplacer.size) {
    const { error: e } = await admin.from("parent_eleves")
      .upsert([...aDeplacer.values()], { onConflict: "compte_id,eleve_id", ignoreDuplicates: true });
    if (e) throw new Error(e.message);
  }

  // 2. Plus aucun enfant sur les comptes absorbés.
  const { error: suppErr } = await admin.from("parent_eleves").delete().in("compte_id", sourceIds);
  if (suppErr) throw new Error(suppErr.message);

  // 3. Compte conservé : numéro et profil complétés depuis les absorbés, sans
  //    rien écraser.
  const extra = { ...extraCible };
  let telephone = (cible.telephone as string | null) || null;
  for (const s of sources) {
    telephone = telephone || (s.telephone as string | null) || null;
    const extraSource = (s.extra || {}) as Record<string, unknown>;
    for (const cle of ["tuteur", "contactTuteur", "filiation"]) {
      if (!String(extra[cle] ?? "").trim() && String(extraSource[cle] ?? "").trim()) extra[cle] = extraSource[cle];
    }
  }
  const maj: Record<string, unknown> = {};
  if (telephone !== ((cible.telephone as string | null) || null)) maj.telephone = telephone;
  if (JSON.stringify(extra) !== JSON.stringify(extraCible)) maj.extra = extra;
  if (Object.keys(maj).length) {
    const { error: e } = await admin.from("comptes").update(maj).eq("id", cibleId);
    if (e) throw new Error(e.message);
  }

  // 4. Comptes absorbés désactivés, avec la trace du compte conservé.
  const le = new Date().toISOString();
  for (const s of sources) {
    const { error: e } = await admin.from("comptes")
      .update({ statut: "Inactif", extra: { ...((s.extra || {}) as Record<string, unknown>), fusionneDans: cibleId, fusionneLe: le } })
      .eq("id", s.id);
    if (e) throw new Error(e.message);
  }

  return {
    cible: { id: cibleId, login: String(cible.login) },
    absorbes: sources.map((s) => ({ id: String(s.id), login: String(s.login), user_id: (s.user_id as string | null) || null })),
    liensDeplaces: aDeplacer.size,
  };
}
