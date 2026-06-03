// Helpers purs des onglets Écoles / Plans du panel super-admin :
// génération de code école (slug), construction de la mise à jour de plan,
// et filtrage de la liste. Aucun accès réseau ici.

// Code école dérivé du nom : minuscules, sans accents, alphanumérique tireté.
export function genSlug(nom) {
  return nom.toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "ecole";
}

// Objet de mise à jour Firestore selon le plan choisi (gratuit = sans expiry).
export function buildPlanUpdate(planChoix, planDuree) {
  return planChoix === "gratuit"
    ? { plan: "gratuit", planExpiry: null, planActivatedBy: "superadmin", planActivatedAt: Date.now() }
    : { plan: planChoix, planExpiry: Date.now() + planDuree * 86400000, planActivatedBy: "superadmin", planActivatedAt: Date.now() };
}

// Filtre les écoles sur nom / ville / code.
export function filtrerEcoles(ecoles, recherche) {
  const q = recherche.toLowerCase();
  return ecoles.filter(e =>
    e.nom?.toLowerCase().includes(q) ||
    e.ville?.toLowerCase().includes(q) ||
    e._id?.toLowerCase().includes(q)
  );
}
