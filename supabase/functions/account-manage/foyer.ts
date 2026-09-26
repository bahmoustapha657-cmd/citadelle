// ════════════════════════════════════════════════════════════════════════
//  account-manage — un foyer, un compte parent (tous ses enfants, toutes sections)
// ════════════════════════════════════════════════════════════════════════
// Module SANS dépendance (comme droits.ts) : index.ts l'importe avec son
// client service_role, et les tests Node (tests/comptes-parents.test.js) le
// chargent tel quel avec un faux client.
//
// Avant de créer un compte parent, on cherche celui du MÊME FOYER parmi les
// comptes parents de l'école : les élèves y sont alors seulement rattachés
// (parent_eleves) et le mot de passe ne change pas. L'API Firebase le
// faisait (api/_lib/account-links.js, hasSameParentHousehold) ; l'Edge
// Function l'avait perdu, et une fratrie finissait avec un compte par enfant
// — alors que la modale annonçait toujours le rattachement.
//
// parent_eleves fait foi : extra.eleveIds n'est qu'un reliquat (identifiants
// Firebase pour les comptes migrés), jamais lu ici.

export type Foyer = { tuteur?: unknown; contactTuteur?: unknown; filiation?: unknown };

export type CompteParent = {
  id: string;
  login: string;
  statut?: string | null;
  premiere_co?: boolean | null;
  created_at?: string | null;
  extra?: Record<string, unknown> | null;
  foyers: Foyer[]; // profil du compte + fiches de ses enfants
  eleveIds: string[]; // enfants rattachés (parent_eleves)
};

// Normalisation E.164 Guinée (miroir de shared/phone.js, que Deno ne partage pas).
export function normaliserTel(brut: unknown): string | null {
  if (!brut) return null;
  const premier = String(brut).split(/[/,;]| ou /i)[0];
  let d = premier.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("224")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("6")) return "+224" + d;
  return null;
}

// Nom comparable : sans casse, accents ni ponctuation, mots dans l'ordre
// alphabétique — « DIALLO Mamadou » et « Mamadou Diallo » se rejoignent.
export function nomComparable(brut: unknown): string {
  return String(brut ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean).sort().join(" ");
}

// Même foyer ? Le tuteur doit être nommé, et de la même façon, des deux
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

// Compte du foyer parmi les comptes parents de l'école, ou null. S'il y en a
// plusieurs (doublons déjà créés), on garde : celui qui suit déjà un des
// élèves, puis un compte actif, puis un compte en service (premiere_co levé :
// le parent a choisi son mot de passe), puis le plus ancien.
export function trouverCompteFoyer(comptes: CompteParent[], candidats: Foyer[], eleveIds: string[]): CompteParent | null {
  const vises = new Set(eleveIds);
  const suitUnEleve = (c: CompteParent) => c.eleveIds.some((id) => vises.has(id));
  const duFoyer = comptes.filter((c) => suitUnEleve(c)
    || c.foyers.some((f) => candidats.some((candidat) => memeFoyer(candidat, f))));
  const rang = (c: CompteParent) => [suitUnEleve(c) ? 0 : 1, actif(c) ? 0 : 1, c.premiere_co === false ? 0 : 1];
  duFoyer.sort((a, b) => {
    const ra = rang(a), rb = rang(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return String(a.created_at || "").localeCompare(String(b.created_at || ""));
  });
  return duFoyer[0] || null;
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

// Comptes parents de l'école, chacun avec ses enfants et les profils de foyer
// connus : le sien (extra) et celui de la fiche de chaque enfant rattaché.
export async function chargerComptesParents(admin: Client, ecoleId: string): Promise<CompteParent[]> {
  const comptes = await lireTout(() => admin.from("comptes")
    .select("id, login, statut, premiere_co, created_at, extra")
    .eq("ecole_id", ecoleId).eq("role", "parent").order("id"));
  const liens = await lireTout(() => admin.from("parent_eleves")
    .select("compte_id, eleve_id, eleves!inner(ecole_id, tuteur, contact_tuteur, filiation)")
    .eq("eleves.ecole_id", ecoleId).order("compte_id").order("eleve_id"));

  const parCompte = new Map<string, CompteParent>();
  for (const c of comptes) {
    const extra = (c.extra || {}) as Record<string, unknown>;
    parCompte.set(String(c.id), {
      id: String(c.id), login: String(c.login), statut: c.statut as string | null,
      premiere_co: c.premiere_co as boolean | null, created_at: c.created_at as string | null, extra,
      foyers: [{ tuteur: extra.tuteur, contactTuteur: extra.contactTuteur, filiation: extra.filiation }],
      eleveIds: [],
    });
  }
  for (const l of liens) {
    const compte = parCompte.get(String(l.compte_id));
    if (!compte) continue;
    compte.eleveIds.push(String(l.eleve_id));
    compte.foyers.push(foyerEleve(l.eleves as Record<string, unknown>));
  }
  return [...parCompte.values()];
}

// Rattache les élèves au compte de leur foyer s'il existe. Renvoie :
//   • { status, error } : élève absent de l'école (ou pas encore synchronisé) ;
//   • { compte, rattaches } : élèves rattachés au compte existant (rattaches =
//     nombre de NOUVEAUX liens, 0 si tous l'étaient déjà) ;
//   • null : aucun compte pour ce foyer — à l'appelant de le créer.
export async function rattacherAuFoyer(
  admin: Client,
  { ecoleId, eleveIds: demandes, foyer }: { ecoleId: string; eleveIds: string[]; foyer: Foyer },
): Promise<{ status: number; error: string } | { compte: CompteParent; rattaches: number } | null> {
  const eleveIds = [...new Set(demandes.map(String).filter(Boolean))];
  const { data: eleves, error } = await admin.from("eleves")
    .select("id, tuteur, contact_tuteur, filiation").eq("ecole_id", ecoleId).in("id", eleveIds);
  if (error) throw new Error(error.message);
  if ((eleves || []).length !== eleveIds.length) {
    return {
      status: 409,
      error: "Élève introuvable dans cette école. S'il vient d'être inscrit, réessayez dans un instant (synchronisation en cours).",
    };
  }

  const candidats = [foyer, ...(eleves as Record<string, unknown>[]).map(foyerEleve)];
  const compte = trouverCompteFoyer(await chargerComptesParents(admin, ecoleId), candidats, eleveIds);
  if (!compte) return null;

  const nouveaux = eleveIds.filter((id) => !compte.eleveIds.includes(id));
  if (nouveaux.length) {
    const { error: lienErr } = await admin.from("parent_eleves").upsert(
      nouveaux.map((eid) => ({ compte_id: compte.id, eleve_id: eid })),
      { onConflict: "compte_id,eleve_id" },
    );
    if (lienErr) throw new Error(lienErr.message);
  }

  // Profil du foyer incomplet sur le compte (compte migré, fiche partielle) :
  // on le complète sans rien écraser, pour les rapprochements suivants.
  const extra = compte.extra || {};
  const complements: Record<string, unknown> = {};
  for (const cle of ["tuteur", "contactTuteur", "filiation"] as const) {
    if (!String(extra[cle] ?? "").trim() && String(foyer[cle] ?? "").trim()) complements[cle] = foyer[cle];
  }
  if (Object.keys(complements).length) {
    await admin.from("comptes").update({ extra: { ...extra, ...complements } }).eq("id", compte.id);
  }

  return { compte, rattaches: nouveaux.length };
}
