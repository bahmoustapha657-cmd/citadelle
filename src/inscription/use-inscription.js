import { useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../apiClient";

// Logique d'inscription d'une nouvelle école : formulaire 3 étapes
// (infos école → compte admin → succès), validations et appel /inscription.
export function useInscription() {
  const { t } = useTranslation();
  const [etape, setEtape] = useState(1); // 1=infos ecole, 2=compte admin, 3=succes
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState("");
  const [comptesInit, setComptesInit] = useState(null);
  const [form, setForm] = useState({
    nomEcole: "",
    ville: "",
    pays: "Guinee",
    adminLogin: "",
    adminMdp: "",
    adminMdp2: "",
  });

  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const comptesSecondaires = comptesInit
    ? Object.values(comptesInit).filter((compte) => compte?.login && compte?.mdp)
    : [];

  const validerEtape1 = () => {
    if (!form.nomEcole.trim()) {
      setErreur(t("register.errors.schoolNameRequired"));
      return false;
    }
    if (!form.ville.trim()) {
      setErreur(t("register.errors.cityRequired"));
      return false;
    }
    setErreur("");
    return true;
  };

  const validerEtape2 = () => {
    if (!form.adminLogin.trim()) {
      setErreur(t("register.errors.adminLoginRequired"));
      return false;
    }
    if (form.adminMdp.length < 8) {
      setErreur(t("register.errors.passwordTooShort"));
      return false;
    }
    if (form.adminMdp !== form.adminMdp2) {
      setErreur(t("register.errors.passwordsMismatch"));
      return false;
    }
    setErreur("");
    return true;
  };

  const inscrire = async () => {
    if (!validerEtape2()) return;
    setChargement(true);
    setErreur("");
    try {
      const r = await apiFetch("/inscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nomEcole: form.nomEcole,
          ville: form.ville,
          pays: form.pays,
          adminLogin: form.adminLogin,
          adminMdp: form.adminMdp,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
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

  return {
    etape, setEtape,
    chargement,
    erreur, setErreur,
    form,
    chg,
    comptesSecondaires,
    validerEtape1,
    inscrire,
  };
}
