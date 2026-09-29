import { useEffect, useState } from "react";
import { demanderReinitialisation, validerCodeReinitialisation } from "../../backend/password-reset-supabase";
import { codeARedemander, messageErreurCode } from "../../backend/code-reinitialisation";

// Logique de la modale « Mot de passe oublié » : demande (code école +
// identifiant, e-mail ou numéro), puis — si le serveur a envoyé un code par
// SMS / WhatsApp — saisie du code et du nouveau mot de passe.
export function useMotDePasseOublie({ codeEcoleInitial = "" }) {
  const [codeEcole, setCodeEcole] = useState(codeEcoleInitial);
  const [identifiant, setIdentifiant] = useState("");
  const [chargement, setChargement] = useState(false);
  const [resultat, setResultat] = useState(null); // réponse de la demande { method, … }
  const [code, setCode] = useState("");
  const [mdp, setMdp] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [voir, setVoir] = useState(false);
  const [erreur, setErreur] = useState(null); // { message, redemander }
  const [attente, setAttente] = useState(0); // secondes avant de pouvoir redemander un code
  const [compte, setCompte] = useState(null); // { login, schoolId } une fois le mot de passe enregistré

  // Compte à rebours du bouton « Renvoyer le code ».
  useEffect(() => {
    if (attente <= 0) return undefined;
    const minuteur = setTimeout(() => setAttente((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(minuteur);
  }, [attente]);

  const demande = { schoolId: codeEcole.trim().toLowerCase(), identifiant: identifiant.trim() };
  const peutDemander = Boolean(demande.schoolId) && demande.identifiant.length >= 2;

  // Première demande, et « Renvoyer le code » ensuite.
  const demander = async () => {
    if (chargement || !peutDemander) return;
    setChargement(true);
    setErreur(null);
    try {
      const r = (await demanderReinitialisation(demande)) || { method: "generic" };
      setResultat(r);
      if (r.method === "code") {
        setAttente(Math.max(0, Number(r.attente) || 0));
        if (r.envoye) setCode("");
      }
    } finally {
      setChargement(false);
    }
  };

  const enregistrer = async () => {
    if (chargement) return; // Entrée pressée deux fois
    setErreur(null);
    if (!/^\d{6}$/.test(code.replace(/[\s.-]/g, ""))) { setErreur({ message: messageErreurCode({ erreur: "code_invalide" }) }); return; }
    if (mdp.length < 8) { setErreur({ message: messageErreurCode({ erreur: "mdp_court" }) }); return; }
    if (mdp !== confirmation) { setErreur({ message: "Les deux mots de passe ne correspondent pas." }); return; }
    setChargement(true);
    try {
      const r = await validerCodeReinitialisation({ ...demande, code, nouveauMdp: mdp });
      if (r?.ok) setCompte({ login: r.login || "", schoolId: r.schoolId || demande.schoolId });
      else setErreur({ message: messageErreurCode(r), redemander: codeARedemander(r?.erreur) });
    } finally {
      setChargement(false);
    }
  };

  return {
    codeEcole, setCodeEcole,
    identifiant, setIdentifiant,
    peutDemander, demander,
    chargement, resultat,
    etapeCode: resultat?.method === "code" && !compte,
    code, setCode,
    mdp, setMdp,
    confirmation, setConfirmation,
    voir, setVoir,
    erreur, attente,
    enregistrer, compte,
  };
}
