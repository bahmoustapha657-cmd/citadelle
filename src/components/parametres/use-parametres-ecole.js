// ══════════════════════════════════════════════════════════════
//  Hook métier de l'écran « Paramètres de l'école »
// ══════════════════════════════════════════════════════════════
// Centralise tout l'état partagé (form, accueil, evaluationForms, danger…),
// les handlers (uploads, couleurs, sauvegarde, cycle de vie) et les styles
// partagés. La vue (ParametresEcole.jsx) ne fait que consommer ce hook.
import { useContext, useEffect, useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { C, setMonnaie } from "../../constants";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { db } from "../../firebaseDb";
import { apiFetch, getAuthHeaders } from "../../apiClient";
import { getEvaluationFormsConfig } from "../../evaluation-forms";
import { extraireCouleurs } from "./extraire-couleurs";

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
  const [form,setForm] = useState({
    nom: schoolInfo.nom||"",
    type: schoolInfo.type||"Groupe Scolaire Privé",
    ville: schoolInfo.ville||"",
    pays: schoolInfo.pays||"République de Guinée",
    couleur1: schoolInfo.couleur1||"#0A1628",
    couleur2: schoolInfo.couleur2||"#00C48C",
    logo: schoolInfo.logo||"",
    devise: schoolInfo.devise||"",
    monnaie: schoolInfo.monnaie||"GNF",
    ministere: schoolInfo.ministere||"",
    ire: schoolInfo.ire||"",
    dpe: schoolInfo.dpe||"",
    agrement: schoolInfo.agrement||"",
    moisDebut: schoolInfo.moisDebut||"Octobre",
    periodicite: schoolInfo.periodicite||"trimestre",
    // Périodicité par section : permet "Primaire trimestre / Secondaire semestre".
    // Fallback sur le champ legacy `periodicite` pour rétrocompat.
    periodicitePrimaire: schoolInfo.periodicitePrimaire||schoolInfo.periodicite||"trimestre",
    periodiciteSecondaire: schoolInfo.periodiciteSecondaire||schoolInfo.periodicite||"trimestre",
  });
  const acc0 = schoolInfo.accueil||{};
  const [accueil, setAccueil] = useState({
    active: acc0.active||false,
    slogan: acc0.slogan||"",
    texteAccueil: acc0.texteAccueil||"",
    bannerUrl: acc0.bannerUrl||"",
    photos: acc0.photos||[],
    showAnnonces: acc0.showAnnonces!==false,
    showHonneurs: acc0.showHonneurs!==false,
    showContact: acc0.showContact!==false,
    telephone: acc0.telephone||"",
    email: acc0.email||"",
    facebook: acc0.facebook||"",
    whatsapp: acc0.whatsapp||"",
    adresse: acc0.adresse||"",
  });
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
  const dangerConfig = {
    deactivate: {
      title: "Desactiver l'ecole",
      confirmation: "DESACTIVER",
      tone: "#b45309",
      bg: "#fff7ed",
      border: "#fdba74",
      button: "#f59e0b",
      description: "L'acces sera bloque pour tous les comptes de cette ecole jusqu'a reactivation.",
    },
    delete: {
      title: "Supprimer l'ecole",
      confirmation: "SUPPRIMER",
      tone: "#b91c1c",
      bg: "#fef2f2",
      border: "#fca5a5",
      button: "#dc2626",
      description: "Suppression logique uniquement : les donnees sont preservees, mais l'ecole disparait de l'acces normal.",
    },
  };

  // Upload logo fichier → base64 + extraction couleurs
  const handleLogoFile = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 500*1024){ setErreur("Logo trop grand (max 500 Ko)."); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      setForm(p=>({...p,logo:src}));
      setApercu(src);
      setCouleursDetectees(null);
      extraireCouleurs(src, (c1, c2) => {
        if(c1) setCouleursDetectees({c1, c2});
      });
    };
    reader.readAsDataURL(file);
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
        const monnaie = (form.monnaie||"GNF").trim().toUpperCase();
        await updateDoc(doc(db,"ecoles",schoolId), { monnaie });
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
      const data = {
        nom: form.nom.trim(),
        type: form.type.trim(),
        ville: form.ville.trim(),
        pays: form.pays.trim(),
        couleur1: form.couleur1,
        couleur2: form.couleur2,
        logo: form.logo||null,
        devise: form.devise.trim(),
        monnaie: (form.monnaie||"GNF").trim().toUpperCase(),
        // ministere / ire / dpe / agrement : MIGRÉS vers /ecoles/{schoolId}/config/legal
        // (édités via le widget Conformité). Plus écrits par ce formulaire.
        // Les valeurs Firestore existantes restent en place (updateDoc merge),
        // utilisées par resolveLegalFields() comme fallback tant que le profil
        // légal structuré n'est pas complet.
        moisDebut: form.moisDebut,
        periodicite: form.periodicite || "trimestre",
        periodicitePrimaire: form.periodicitePrimaire || "trimestre",
        periodiciteSecondaire: form.periodiciteSecondaire || "trimestre",
        evaluationForms,
        accueil: {
          active: accueil.active,
          slogan: accueil.slogan.trim(),
          texteAccueil: accueil.texteAccueil.trim(),
          bannerUrl: accueil.bannerUrl.trim(),
          photos: accueil.photos,
          showAnnonces: accueil.showAnnonces,
          showHonneurs: accueil.showHonneurs,
          showContact: accueil.showContact,
          telephone: accueil.telephone.trim(),
          email: accueil.email.trim(),
          facebook: accueil.facebook.trim(),
          whatsapp: accueil.whatsapp.trim(),
          adresse: accueil.adresse.trim(),
        },
      };
      await updateDoc(doc(db,"ecoles",schoolId), data);
      setSchoolInfo(prev=>({...prev,...data}));
      setMonnaie(data.monnaie);
      try {
        const headers = await getAuthHeaders({ "Content-Type": "application/json" });
        await apiFetch("/ecole-public-sync", {
          method: "POST",
          headers,
          body: JSON.stringify({ action: "sync", schoolId }),
        });
      } catch { /* non-bloquant : la source privée est à jour */ }
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
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const response = await apiFetch("/school-lifecycle", {
        method: "POST",
        headers,
        body: JSON.stringify({
          schoolId,
          action: dangerAction,
          confirmation: dangerConfirmation,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) {
        setErreur(data.error || "Action impossible pour le moment.");
        return;
      }

      const nextInfo = {
        ...schoolInfo,
        actif: data.actif,
        supprime: data.supprime,
      };
      setSchoolInfo(nextInfo);
      setDangerAction("");
      setDangerConfirmation("");

      if (dangerAction === "delete") {
        toast("Ecole supprimee.", "success");
      } else {
        toast("Ecole desactivee.", "success");
      }

      localStorage.removeItem("LC_schoolId");
      if (typeof onSchoolClosed === "function") {
        onSchoolClosed();
      }
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
      const reader = new FileReader();
      reader.onload = ev => {
        setAccueil(p=>({...p, photos:[...(p.photos||[]), {url:ev.target.result, caption:""}]}));
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  // Upload bannière → base64
  const handleBanniere = e => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 1024*1024){ setErreur("Bannière trop grande (max 1 Mo)."); return; }
    const reader = new FileReader();
    reader.onload = ev => setAccueil(p=>({...p, bannerUrl:ev.target.result}));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const resetLogo = () => { setForm(p=>({...p,logo:""})); setApercu(null); };

  const inp = {
    width:"100%",border:"1px solid #d1d5db",borderRadius:8,
    padding:"9px 12px",fontSize:13,outline:"none",boxSizing:"border-box",
  };
  const lbl = {
    display:"block",fontSize:11,fontWeight:700,color:C.blueDark,
    textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4,marginTop:14,
  };
  const sec = {
    background:"#fff",borderRadius:14,padding:"24px 28px",
    boxShadow:"0 2px 16px rgba(0,32,80,0.07)",marginBottom:20,
  };
  const tabItems = [
    {id:"identite", label:"Identite"},
    {id:"accueil", label:"Accueil"},
    {id:"officiel", label:"Officiel"},
    {id:"evaluations", label:"Evaluations"},
    {id:"matricules", label:"Matricules"},
    {id:"affichage", label:"Affichage"},
    ...(canManageLifecycle ? [{id:"danger", label:"Danger"}] : []),
  ];

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
    handleLogoFile, appliquerCouleursDetectees, sauvegarder, lancerActionEcole,
    handlePhotoGalerie, handleBanniere, resetLogo,
    inp, lbl, sec, tabItems,
  };
}
