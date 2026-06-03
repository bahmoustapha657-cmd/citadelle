import { useState } from "react";
import { useTranslation } from "react-i18next";
import { erreurEtape1, erreurEtape2 } from "./inscription-validation";
import { soumettreInscription } from "./inscription-api";

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

  const valider = (erreurFn) => {
    const msg = erreurFn(form, t);
    setErreur(msg);
    return !msg;
  };
  const validerEtape1 = () => valider(erreurEtape1);
  const validerEtape2 = () => valider(erreurEtape2);

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
