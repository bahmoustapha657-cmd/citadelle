// ════════════════════════════════════════════════════════════════════════
//  Paiement en ligne — lectures et écritures (service_role)
// ════════════════════════════════════════════════════════════════════════
// Toute écriture d'un paiement passe ici : changement de statut toujours
// conditionné au statut « en_attente » (deux confirmations simultanées ne
// font qu'un traitement), imputation par la fonction SQL atomique
// imputer_paiement_en_ligne.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type Config, fournisseur } from "./fournisseurs.ts";
import {
  contexteEleve, dateFr, montantConforme, type PaiementLigne, planImputation, type Verification,
} from "./regles.ts";

type Admin = SupabaseClient;

export async function lireConfig(admin: Admin, ecoleId: string): Promise<Config | null> {
  const { data, error } = await admin.from("paiement_config")
    .select("fournisseur, mode, actif, frais_pourcent, identifiants").eq("ecole_id", ecoleId).maybeSingle();
  if (error) throw error;
  return data as Config | null;
}

// Données de calcul d'un élève : son école, sa fiche, les tarifs.
export async function chargerContexte(admin: Admin, ecoleId: string, eleveId: string) {
  const [ecole, eleve, tarifs] = await Promise.all([
    admin.from("ecoles").select("id, code, actif, supprime, extra").eq("id", ecoleId).single(),
    admin.from("eleves").select("*").eq("id", eleveId).eq("ecole_id", ecoleId).single(),
    admin.from("tarifs").select("*").eq("ecole_id", ecoleId),
  ]);
  for (const r of [ecole, eleve, tarifs]) if (r.error) throw r.error;
  return {
    ecole: ecole.data,
    ctx: contexteEleve({ ecole: ecole.data, eleveRow: eleve.data, tarifsRows: tarifs.data || [] }),
  };
}

// Changement de statut CONDITIONNEL : seulement depuis « en_attente ».
async function terminer(admin: Admin, p: PaiementLigne, statut: "echoue" | "a_verifier", detail: Record<string, unknown>) {
  const { error } = await admin.from("paiements_en_ligne")
    .update({ statut, detail: { ...(p.detail || {}), ...detail } })
    .eq("id", p.id).eq("statut", "en_attente");
  if (error) throw error;
}

// Applique un paiement confirmé à la fiche de l'élève. Une fiche modifiée
// entre le calcul et l'écriture (encaissement en caisse au même moment) :
// on recalcule, trois fois au plus, puis on laisse la main au comptable.
async function imputer(admin: Admin, p: PaiementLigne, operateur?: string): Promise<string> {
  // Fiche supprimée entre-temps : l'argent est reçu, le comptable décide.
  if (!p.eleve_id) {
    await terminer(admin, p, "a_verifier", { motif: "eleve", operateur });
    return "a_verifier";
  }
  for (let essai = 0; essai < 3; essai++) {
    const { ctx } = await chargerContexte(admin, p.ecole_id, p.eleve_id);
    const plan = planImputation(ctx, p, { date: dateFr(), operateur });
    if (!plan.ok) {
      await terminer(admin, p, "a_verifier", { motif: plan.raison, operateur });
      return "a_verifier";
    }
    const { data, error } = await admin.rpc("imputer_paiement_en_ligne", {
      p_paiement: p.id,
      p_eleve_maj: ctx.eleveMaj,
      p_extra: plan.extra,
      p_journal: plan.journal,
      p_historique: plan.historique,
      p_detail: { lignes: plan.lignes, operateur: operateur || null },
    });
    if (error) throw error;
    if (data !== "conflit") return data as string;
  }
  await terminer(admin, p, "a_verifier", { motif: "conflit_repete", operateur });
  return "a_verifier";
}

// Suite à donner au résultat d'une VÉRIFICATION auprès de l'opérateur.
export async function appliquerVerification(admin: Admin, p: PaiementLigne, v: Verification): Promise<string> {
  if (p.statut !== "en_attente") return p.statut;
  if (v.statut === "en_attente") return "en_attente";
  if (v.statut === "echoue") {
    await terminer(admin, p, "echoue", { motif: v.detail?.motif || "refusé", ...(v.detail || {}) });
    return "echoue";
  }
  if (!montantConforme(p, v)) {
    await terminer(admin, p, "a_verifier", { motif: "montant", montantRecu: v.montant ?? null, deviseRecue: v.devise ?? null });
    return "a_verifier";
  }
  return imputer(admin, p, v.operateur);
}

// Interroge l'opérateur puis applique : utilisé au retour du parent et à
// chaque notification (dont le contenu n'est jamais cru sur parole).
export async function verifierEtAppliquer(admin: Admin, p: PaiementLigne): Promise<string> {
  if (p.statut !== "en_attente") return p.statut;
  const config = await lireConfig(admin, p.ecole_id);
  if (!config) return p.statut;
  const verification = await fournisseur(p.fournisseur).verifier(p, config);
  return appliquerVerification(admin, p, verification);
}

export async function lireParReference(admin: Admin, reference: string): Promise<PaiementLigne | null> {
  const { data, error } = await admin.from("paiements_en_ligne").select("*").eq("reference", reference).maybeSingle();
  if (error) throw error;
  return data as PaiementLigne | null;
}
