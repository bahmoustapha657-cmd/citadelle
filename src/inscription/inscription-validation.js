// Validations pures du formulaire d'inscription. Chaque fonction renvoie
// un message d'erreur traduit, ou "" si l'étape est valide.

export function erreurEtape1(form, t) {
  if (!form.nomEcole.trim()) return t("register.errors.schoolNameRequired");
  if (!form.ville.trim()) return t("register.errors.cityRequired");
  return "";
}

export function erreurEtape2(form, t) {
  if (!form.adminLogin.trim()) return t("register.errors.adminLoginRequired");
  if (form.adminMdp.length < 8) return t("register.errors.passwordTooShort");
  if (form.adminMdp !== form.adminMdp2) return t("register.errors.passwordsMismatch");
  return "";
}
