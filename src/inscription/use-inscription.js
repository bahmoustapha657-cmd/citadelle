import { useState } from "react";
import { useTranslation } from "react-i18next";
import { erreurEnseignant, erreurEtape1, erreurEtape2 } from "./inscription-validation";
import { soumettreInscription, soumettreInscriptionEnseignant } from "./inscription-api";

// Logique d'inscription. Deux profils, choisis au premier écran :
//  - une école : formulaire 3 étapes (infos école → compte admin → succès) ;
//  - un enseignant indépendant : une étape, puis le succès. Son numéro de
//    téléphone devient son code et son identifiant.
export function useInscription() {
  const { t } = useTranslation();
  const [profil, setProfil] = useState(null); // null = choix, "ecole" | "enseignant"
  const [etape, setEtape] = useState(1); // 1=infos ecole, 2=compte admin, 3=succes
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [comptesInit, setComptesInit] = useState(null);
  // Espace enseignant créé : { code, login } renvoyés par le serveur.
  const [espaceCree, setEspaceCree] = useState(null);
  const [form, setForm] = useState({
    nomEcole: "",
    ville: "",
    pays: "Guinee",
    responsable: "",
    telephone: "",
    email: "",
    statutEtablissement: "prive", // « public » : école publique (prix fixe)
    adminLogin: "",
    adminMdp: "",
    adminMdp2: "",
    // Enseignant indépendant
    nomEnseignant: "",
    etablissement: "",
    sections: [],
    website: "", // honeypot anti-bot : doit rester vide (champ masqué)
  });

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const basculerNiveau = (id) => setForm((p) => ({
    ...p,
    sections: p.sections.includes(id) ? p.sections.filter((s) => s !== id) : [...p.sections, id],
  }));
  const comptesSecondaires = comptesInit
    ? Object.values(comptesInit).filter((compte) => compte?.login && compte?.mdp)
    : [];

  const valider = (erreurFn) => {
    const msg = erreurFn(form, t);
    setErreur(msg);
    return !msg;
  };
  const validerEtape1 = () => valider(erreurEtape1);
  const validerEtape2 = () => valider(erreurEtape2);

  // « publique » : le parcours d'une école, avec son statut déclaré (il lui
  // propose d'abord l'offre école publique ; le plan reste attribué par EduGest).
  const choisirProfil = (p) => {
    setProfil(p === "publique" ? "ecole" : p);
    setForm((f) => ({ ...f, statutEtablissement: p === "publique" ? "public" : "prive" }));
    setEtape(1);
    setErreur("");
  };

  const inscrire = async () => {
    if (!validerEtape2()) return;
    setChargement(true);
    setErreur("");
    try {
      const { ok, data } = await soumettreInscription(form);
      if (!ok) {
        setErreur(data.error || t("register.errors.submitFailed"));
        return;
      }
      localStorage.setItem("LC_schoolId", data.schoolId);
      localStorage.removeItem("LC_comptes_init");
      setComptesInit(data.compteSecondaires || null);
      setEtape(3);
    } catch (e) {
      console.error(e);
      setErreur(t("register.errors.networkError"));
    } finally {
      setChargement(false);
    }
  };

  const inscrireEnseignant = async () => {
    if (!valider(erreurEnseignant)) return;
    setChargement(true);
    setErreur("");
    try {
      const { ok, data } = await soumettreInscriptionEnseignant(form);
      if (!ok) {
        setErreur(data.error || t("register.errors.submitFailed"));
        return;
      }
      // Le formulaire de connexion s'ouvrira sur ce code.
      localStorage.setItem("LC_schoolId", data.schoolId);
      setEspaceCree({ code: data.schoolId, login: data.login || data.schoolId });
      setEtape(3);
    } catch (e) {
      console.error(e);
      setErreur(t("register.errors.networkError"));
    } finally {
      setChargement(false);
    }
  };

  return {
    profil, choisirProfil,
    etape, setEtape,
    chargement,
    erreur, setErreur,
    form,
    chg,
    basculerNiveau,
    comptesSecondaires,
    espaceCree,
    validerEtape1,
    inscrire,
    inscrireEnseignant,
  };
}
