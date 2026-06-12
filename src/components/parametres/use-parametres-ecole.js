// ══════════════════════════════════════════════════════════════
//  Hook métier de l'écran « Paramètres de l'école »
// ══════════════════════════════════════════════════════════════
// Centralise l'état partagé (form, accueil, evaluationForms, danger…) et
// orchestre les handlers (uploads, couleurs, sauvegarde, cycle de vie).
// Les données/styles purs vivent dans ./use-parametres/parametres-config,
// les appels réseau dans ./use-parametres/parametres-api. La vue
// (ParametresEcole.jsx) ne fait que consommer ce hook.
import { useContext, useEffect, useState } from "react";
import { setMonnaie } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { getEvaluationFormsConfig } from "../../evaluation-forms";
import { extraireCouleurs } from "./extraire-couleurs";
import {
  buildFormInitial, buildAccueilInitial, dangerConfig, buildTabItems, inp, lbl, sec,
} from "./use-parametres/parametres-config";
import {
  sauvegarderMonnaie, sauvegarderParametres, executerCycleVie,
} from "./use-parametres/parametres-api";
import { lireImageEnBase64 } from "./use-parametres/parametres-uploads";

export function useParametresEcole({ utilisateurRole = "", onSchoolClosed = null, initialTab = null, onTabConsumed = null }) {
  const {schoolId,schoolInfo,setSchoolInfo,toast} = useContext(SchoolContext);
  const {items:honneurs, ajouter:ajHonneur, modifier:modHonneur, supprimer:supHonneur} = useFirestore("honneurs");
  const [tabParam, setTabParam] = useState(initialTab || "identite");
  // Si App nous transmet un onglet initial (deep-link depuis dashboard),
  // on l'applique au mount puis on demande à App de le réinitialiser
  // pour ne pas re-écraser le choix de l'utilisateur lors d'un retour.
  useEffect(() => {
    if (initialTab) {
      setTabParam(initialTab);
      if (typeof onTabConsumed === "function") onTabConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab]);
  const [form,setForm] = useState(() => buildFormInitial(schoolInfo));
  const [accueil, setAccueil] = useState(() => buildAccueilInitial(schoolInfo));
  const [formHonneur, setFormHonneur] = useState({});
  const [modalH, setModalH] = useState(null);
  const [evaluationForms, setEvaluationForms] = useState(() => getEvaluationFormsConfig(schoolInfo));
  const chgA = k => e => setAccueil(p=>({...p,[k]: e.target.type==="checkbox"?e.target.checked:e.target.value}));
  const [chargement,setChargement] = useState(false);
  const [msgSucces,setMsgSucces] = useState("");
  const [erreur,setErreur] = useState("");
  const [migrationOuverte, setMigrationOuverte] = useState(false);
  const [apercu,setApercu] = useState(null); // aperçu logo uploadé

  const [dangerAction,setDangerAction] = useState("");
  const [dangerConfirmation,setDangerConfirmation] = useState("");
  const [dangerLoading,setDangerLoading] = useState(false);

  const chg = k => e => setForm(p=>({...p,[k]:e.target.value}));
  const setEvaluationLabel = (groupId, formId, label) => {
    setEvaluationForms((prev) => ({
      ...prev,
      [groupId]: prev[groupId].map((item) => (
        item.id === formId ? { ...item, label } : item
      )),
    }));
  };
  const toggleEvaluationActive = (groupId, formId) => {
    setEvaluationForms((prev) => ({
      ...prev,
      [groupId]: prev[groupId].map((item) => (
        item.id === formId ? { ...item, active: !item.active } : item
      )),
    }));
  };

  const [couleursDetectees, setCouleursDetectees] = useState(null);
  const canManageLifecycle = schoolId && schoolId !== "superadmin" && ["direction","superadmin"].includes(utilisateurRole);
  // Profil légal : direction/admin/superadmin (cf. règle Firestore).
  const peutEditerLegal = ["direction","admin","superadmin"].includes(utilisateurRole);
  // Le comptable n'a accès qu'au sélecteur de monnaie (rules Firestore autorisent
  // uniquement update de `monnaie` pour ce rôle — cf. firestore.rules §/ecoles).
  const isComptableSeul = utilisateurRole === "comptable";

  // Upload logo fichier → base64 + extraction couleurs
  const handleLogoFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 500*1024){ setErreur("Logo trop grand (max 500 Ko)."); return; }
    lireImageEnBase64(file).then(src => {
      setForm(p=>({...p,logo:src}));
      setApercu(src);
      setCouleursDetectees(null);
      extraireCouleurs(src, (c1, c2) => {
        if(c1) setCouleursDetectees({c1, c2});
      });
    });
  };

  // Upload de la signature scannée du directeur → base64 (apposée sur
  // les bulletins dans le bloc signature, les 3 modèles).
  const handleSignatureFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 300*1024){ setErreur("Signature trop grande (max 300 Ko)."); return; }
    lireImageEnBase64(file).then(src => {
      setForm(p=>({...p,signatureUrl:src}));
    });
  };

  const appliquerCouleursDetectees = () => {
    if(!couleursDetectees) return;
    setForm(p=>({...p, couleur1:couleursDetectees.c1, couleur2:couleursDetectees.c2}));
    setCouleursDetectees(null);
  };

  const sauvegarder = async () => {
    if(isComptableSeul) {
      setChargement(true); setErreur("");
      try {
        const monnaie = await sauvegarderMonnaie({ schoolId, monnaie: form.monnaie });
        setSchoolInfo(prev=>({...prev,monnaie}));
        setMonnaie(monnaie);
        setMsgSucces("Monnaie enregistrée.");
        setTimeout(()=>setMsgSucces(""),3000);
      } catch(e) {
        setErreur("Erreur lors de la sauvegarde : "+(e.message||"réessayez."));
      } finally {
        setChargement(false);
      }
      return;
    }
    if(!form.nom.trim()){setErreur("Le nom de l'école est requis.");return;}
    setChargement(true); setErreur("");
    try {
      const data = await sauvegarderParametres({ schoolId, form, accueil, evaluationForms });
      setSchoolInfo(prev=>({...prev,...data}));
      setMonnaie(data.monnaie);
      if(data.couleur1) document.documentElement.style.setProperty("--sc1", data.couleur1);
      if(data.couleur2) document.documentElement.style.setProperty("--sc2", data.couleur2);
      setMsgSucces("Paramètres enregistrés avec succès.");
      setTimeout(()=>setMsgSucces(""),4000);
    } catch(e) {
      setErreur("Erreur lors de la sauvegarde : "+(e.message||"réessayez."));
    } finally {
      setChargement(false);
    }
  };

  const lancerActionEcole = async () => {
    if (!canManageLifecycle || !dangerAction || !dangerConfig[dangerAction]) return;
    setDangerLoading(true);
    setErreur("");
    setMsgSucces("");
    try {
      const { ok, data } = await executerCycleVie({
        schoolId, action: dangerAction, confirmation: dangerConfirmation,
      });
      if (!ok) {
        setErreur(data.error || "Action impossible pour le moment.");
        return;
      }
      setSchoolInfo({ ...schoolInfo, actif: data.actif, supprime: data.supprime });
      setDangerAction("");
      setDangerConfirmation("");
      toast(dangerAction === "delete" ? "Ecole supprimee." : "Ecole desactivee.", "success");
      localStorage.removeItem("LC_schoolId");
      if (typeof onSchoolClosed === "function") onSchoolClosed();
    } catch {
      setErreur("Erreur lors de la mise a jour de l'ecole.");
    } finally {
      setDangerLoading(false);
    }
  };

  // Upload photo galerie → base64
  const handlePhotoGalerie = e => {
    const files = Array.from(e.target.files);
    files.forEach(file => {
      if(file.size > 800*1024){ toast(`${file.name} trop grande (max 800 Ko).`,"warning"); return; }
      lireImageEnBase64(file).then(url => {
        setAccueil(p=>({...p, photos:[...(p.photos||[]), {url, caption:""}]}));
      });
    });
    e.target.value = "";
  };

  // Upload bannière → base64
  const handleBanniere = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 1024*1024){ setErreur("Bannière trop grande (max 1 Mo)."); return; }
    lireImageEnBase64(file).then(url => setAccueil(p=>({...p, bannerUrl:url})));
    e.target.value = "";
  };

  const resetLogo = () => { setForm(p=>({...p,logo:""})); setApercu(null); };

  const tabItems = buildTabItems(canManageLifecycle);

  return {
    schoolId, schoolInfo, toast,
    honneurs, ajHonneur, modHonneur, supHonneur,
    tabParam, setTabParam,
    form, setForm, accueil, setAccueil, chg, chgA,
    formHonneur, setFormHonneur, modalH, setModalH,
    evaluationForms, setEvaluationLabel, toggleEvaluationActive,
    chargement, msgSucces, setMsgSucces, erreur, setErreur,
    migrationOuverte, setMigrationOuverte,
    apercu, couleursDetectees, setCouleursDetectees,
    dangerAction, setDangerAction, dangerConfirmation, setDangerConfirmation, dangerLoading,
    canManageLifecycle, peutEditerLegal, isComptableSeul, dangerConfig,
    handleLogoFile, handleSignatureFile, appliquerCouleursDetectees, sauvegarder, lancerActionEcole,
    handlePhotoGalerie, handleBanniere, resetLogo,
    inp, lbl, sec, tabItems,
  };
}
