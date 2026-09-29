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
