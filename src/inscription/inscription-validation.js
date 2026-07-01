// Validations pures du formulaire d'inscription. Chaque fonction renvoie
// un message d'erreur traduit, ou "" si l'étape est valide.

export function erreurEtape1(form, t) {
  if (!form.nomEcole.trim()) return t("register.errors.schoolNameRequired");
  if (!form.ville.trim()) return t("register.errors.cityRequired");
  if (!form.responsable?.trim()) return "Le nom du responsable est requis.";
  const tel = (form.telephone || "").replace(/[^0-9]/g, "");
  if (!tel) return "Le téléphone du responsable est requis.";
  if (tel.length < 8) return "Numéro de téléphone invalide (au moins 8 chiffres).";
  if (!form.email?.trim()) return "L'adresse email est requise.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) return "Adresse email invalide.";
  return "";
}

export function erreurEtape2(form, t) {
  if (!form.adminLogin.trim()) return t("register.errors.adminLoginRequired");
  if (form.adminMdp.length < 8) return t("register.errors.passwordTooShort");
  if (form.adminMdp !== form.adminMdp2) return t("register.errors.passwordsMismatch");
  return "";
}
