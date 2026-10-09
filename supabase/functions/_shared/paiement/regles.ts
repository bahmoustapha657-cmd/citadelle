// ════════════════════════════════════════════════════════════════════════
//  Paiement en ligne — règles PURES (aucun accès réseau ni base)
// ════════════════════════════════════════════════════════════════════════
// Partagées par les Edge Functions `paiement` et `paiement-notification`,
// testées sous Node (tests/paiement-en-ligne.test.js).
import { ciblesVersement, montantPropose } from "../app/src/versements.js";
import { planVersement, tranchesValides } from "../app/src/paiements-scolarite.js";
import { calcMoisAnnee } from "../app/src/constants.js";
import { toRow, transformRow } from "../app/src/backend/collection-map.js";
import { ecritureEncaissement } from "../app/src/components/comptabilite/paiements-journal.js";

export type Statut = "en_attente" | "impute" | "echoue" | "a_verifier";

// Résultat de la vérification d'un paiement AUPRÈS DE L'OPÉRATEUR — la seule
// source de vérité : une notification entrante ne fait que la déclencher.
export type Verification = {
  statut: "reussi" | "echoue" | "en_attente";
  montant?: number;
  devise?: string;
  operateur?: string;
  detail?: Record<string, unknown>;
};

// deno-lint-ignore no-explicit-any
type Ligne = Record<string, any>;

export type PaiementLigne = {
  id: string;
  ecole_id: string;
  eleve_id: string;
  reference: string;
  fournisseur: string;
  annee: string;
  cible: { cle: string; label?: string };
  montant: number | string;
  frais: number | string;
  devise: string;
  statut: Statut;
  detail: Record<string, unknown>;
};

// Frais de l'opérateur, payés EN PLUS par le parent (choix de l'école) :
// arrondis au franc supérieur, jamais négatifs.
export function calculerFrais(montant: number, pourcent: number): number {
  const p = Number(pourcent) || 0;
  if (!(montant > 0) || p <= 0) return 0;
  return Math.ceil((montant * p) / 100);
}

// Référence envoyée à l'opérateur : unique, courte, lettres et chiffres
// seulement (certains opérateurs refusent tirets et minuscules).
export function nouvelleReference(maintenant = Date.now(), alea: () => number = Math.random): string {
  const temps = maintenant.toString(36).toUpperCase();
  let suffixe = "";
  for (let i = 0; i < 6; i++) suffixe += "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(alea() * 36)];
  return `EDU${temps}${suffixe}`;
}

// Date au format des fiches (« 09/10/2026 », comme toLocaleDateString fr-FR
// côté caisse). Fuseau de Conakry = UTC.
export function dateFr(d = new Date()): string {
  const j = String(d.getUTCDate()).padStart(2, "0");
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${j}/${m}/${d.getUTCFullYear()}`;
}

// Adresse de retour vers l'app après le paiement : seulement EduGest (ou un
// poste de développement), jamais une adresse fournie par un tiers.
export function origineAutorisee(origine: string | null, parDefaut: string): string {
  const o = String(origine || "").replace(/\/+$/, "");
  if (/^https:\/\/edugest-gn\.pages\.dev$/.test(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o)) return o;
  return parDefaut;
}

// Le montant ENCAISSÉ par l'opérateur doit être exactement celui demandé
// (scolarité + frais), dans la bonne devise. Sinon : à vérifier par un humain.
export function montantConforme(p: Pick<PaiementLigne, "montant" | "frais" | "devise">, v: Verification): boolean {
  if (v.montant === undefined) return true;
  const attendu = Number(p.montant) + Number(p.frais);
  const devise = !v.devise || v.devise.toUpperCase() === String(p.devise).toUpperCase();
  return devise && Math.round(Number(v.montant)) === Math.round(attendu);
}

// ── Contexte de calcul d'un élève ──────────────────────────────────────────
// À partir des LIGNES de la base (ecoles, eleves, tarifs), les mêmes objets
// que l'app manipule (transformRow) et les mêmes cibles que la caisse.
export function contexteEleve({ ecole, eleveRow, tarifsRows }: { ecole: Ligne; eleveRow: Ligne; tarifsRows: Ligne[] }) {
  const extra = ecole.extra || {};
  const eleve = transformRow("eleves", eleveRow);
  const tarifsClasses = tarifsRows.map((r) => transformRow("tarifs", r));
  const moisAnnee: string[] = calcMoisAnnee(extra.moisDebut || "Octobre");
  const annee: string = extra.anneeScolaire || "";
  const tranches = tranchesValides(extra.tranchesPaiement, moisAnnee);
  const { cibles, etats, mensualite } = ciblesVersement({ eleve, moisAnnee, annee, tarifsClasses, tranches });
  return { eleve, eleveMaj: eleveRow.updated_at as string, cibles, etats, mensualite, moisAnnee, annee };
}

export type Contexte = ReturnType<typeof contexteEleve>;

// Libellé de l'auteur au journal de caisse.
export const auteurEnLigne = (operateur?: string) => (operateur ? `Paiement en ligne (${operateur})` : "Paiement en ligne");

// ── Plan d'imputation ──────────────────────────────────────────────────────
// Ce que l'imputation écrira : clés de la fiche élève (fusion dans extra),
// lignes du journal, trace d'historique. Refusé (→ « à vérifier ») si
// l'année a changé, si la cible n'existe plus, ou si le montant dépasse
// désormais ce qui reste dû (la caisse a encaissé entre-temps).
export function planImputation(ctx: Contexte, p: PaiementLigne, { date, operateur }: { date: string; operateur?: string }) {
  if (p.annee !== ctx.annee) return { ok: false as const, raison: "annee" };
  const cible = ctx.cibles.find((c: Ligne) => c.cle === p.cible?.cle);
  if (!cible) return { ok: false as const, raison: "cible" };
  const plan = planVersement({
    eleve: ctx.eleve, cible, montant: Number(p.montant), date, mensualite: ctx.mensualite, annee: ctx.annee,
  });
  if (!plan.ok) return { ok: false as const, raison: plan.raison };
  const { row, extraCol } = toRow("eleves", plan.champs);
  // Uniquement des clés de `extra` : c'est ce que fusionne la fonction SQL.
  const colonnes = Object.keys(row).filter((k) => k !== extraCol);
  if (colonnes.length || !extraCol) return { ok: false as const, raison: "colonnes" };
  const auteur = auteurEnLigne(operateur);
  const journal = plan.lignes.map((l: Ligne) => toRow("paiements", {
    ...ecritureEncaissement({
      annee: ctx.annee, eleve: ctx.eleve, type: l.type, mois: l.mois, libelle: l.libelle, montant: l.montant, auteur,
    }),
    reference: p.reference, fournisseur: p.fournisseur, enLigne: true,
  }).row);
  const nom = `${ctx.eleve.nom || ""} ${ctx.eleve.prenom || ""}`.trim();
  const historique = toRow("historique", {
    action: "Paiement en ligne imputé",
    details: `${nom} · ${plan.lignes.map((l: Ligne) => `${l.libelle} ${l.montant}`).join(", ")} · réf. ${p.reference}`,
    auteur,
    date: Date.now(),
  }).row.extra;
  return {
    ok: true as const,
    extra: row[extraCol],
    journal,
    historique,
    lignes: plan.lignes.map((l: Ligne) => ({ libelle: l.libelle, montant: l.montant })),
  };
}

// Cibles proposées au parent : celles qui ont un reste dû, avec le montant
// que la caisse proposerait (inscription + un mois, tout le reste ailleurs).
export function ciblesPayables(ctx: Contexte) {
  return ctx.cibles.filter((c: Ligne) => c.reste > 0).map((c: Ligne) => ({
    cle: c.cle, label: c.label, detail: c.detail || "", reste: c.reste,
    propose: Number(montantPropose(c, ctx.etats)) || c.reste,
  }));
}
