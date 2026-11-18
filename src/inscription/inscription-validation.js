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

// Niveaux qu'un enseignant indépendant peut déclarer (sections de son espace,
// libellés par libelleSection).
export const NIVEAUX_ENSEIGNANT = Object.freeze(["prescolaire", "primaire", "college", "lycee"]);

// Formulaire d'un enseignant indépendant (une seule étape). Mêmes règles que
// le serveur (supabase/functions/inscription/enseignant.ts).
export function erreurEnseignant(form, t) {
  if ((form.nomEnseignant || "").trim().length < 3) return t("register.teacher.errors.nameRequired");
  const tel = (form.telephone || "").replace(/[^0-9]/g, "");
  if (!tel) return t("register.teacher.errors.phoneRequired");
  if (tel.length < 8) return t("register.teacher.errors.phoneInvalid");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((form.email || "").trim())) return t("register.teacher.errors.emailInvalid");
  if (!(form.etablissement || "").trim()) return t("register.teacher.errors.schoolRequired");
  if (!(form.ville || "").trim()) return t("register.errors.cityRequired");
  if (!form.sections?.length) return t("register.teacher.errors.levelRequired");
  if ((form.adminMdp || "").length < 8) return t("register.errors.passwordTooShort");
  if (form.adminMdp !== form.adminMdp2) return t("register.errors.passwordsMismatch");
  return "";
}

export function erreurEtape2(form, t) {
  if (!form.adminLogin.trim()) return t("register.errors.adminLoginRequired");
  if (form.adminMdp.length < 8) return t("register.errors.passwordTooShort");
  if (form.adminMdp !== form.adminMdp2) return t("register.errors.passwordsMismatch");
  return "";
}

// Espace d'un enseignant indépendant (même Edge Function, autre profil).
// Corps envoyé à l'Edge Function inscription (pur : testé sous Node).
export function corpsInscriptionEnseignant(form) {
  return {
    typeEspace: "enseignant",
    nomEnseignant: form.nomEnseignant,
    telephone: form.telephone,
    email: form.email,
    etablissement: form.etablissement,
    ville: form.ville,
    pays: form.pays,
    sections: form.sections,
    mdp: form.adminMdp,
    website: form.website,
  };
}
