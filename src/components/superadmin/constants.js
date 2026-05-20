// Constantes partagées par les onglets du Panel Super-Admin
// (libellés des actions cycle de vie, palette de styles, etc.).
// Extrait de SuperAdminPanel.jsx au refactor découpage 2026-05-20.

import { C } from "../../constants";

// Squelette d'une nouvelle école créée depuis le Panel Super-Admin.
// Les champs nom/ville/pays sont fournis par l'utilisateur ; le reste
// sont des valeurs par défaut (branding, page d'accueil désactivée).
export const NEW_SCHOOL_DEFAULTS = {
  type: "Groupe Scolaire Prive",
  couleur1: "#0A1628",
  couleur2: "#00C48C",
  logo: null,
  devise: "",
  monnaie: "GNF",
  accueil: {
    active: false,
    slogan: "",
    texteAccueil: "",
    bannerUrl: "",
    photos: [],
    showAnnonces: true,
    showHonneurs: true,
    showContact: true,
    telephone: "",
    email: "",
    facebook: "",
    whatsapp: "",
    adresse: "",
  },
  actif: true,
};

// Libellés et palettes pour les actions de cycle de vie (désactiver /
// réactiver / supprimer une école). Le mot-clé de confirmation est
// celui que l'utilisateur doit retaper pour valider l'action.
export const LIFECYCLE_LABELS = {
  deactivate: {
    title: "Desactiver l'ecole",
    confirmation: "DESACTIVER",
    success: "Ecole desactivee.",
    description: "L'acces est bloque jusqu'a reactivation.",
    button: "Desactiver",
    color: "#b45309",
    bg: "#fff7ed",
    border: "#fdba74",
  },
  reactivate: {
    title: "Reactiver l'ecole",
    confirmation: "ACTIVER",
    success: "Ecole reactivee.",
    description: "L'ecole redevient accessible.",
    button: "Reactiver",
    color: "#166534",
    bg: "#f0fdf4",
    border: "#86efac",
  },
  delete: {
    title: "Supprimer l'ecole",
    confirmation: "SUPPRIMER",
    success: "Ecole supprimee logiquement.",
    description: "La suppression est logique uniquement. Les donnees restent conservees.",
    button: "Supprimer",
    color: "#b91c1c",
    bg: "#fef2f2",
    border: "#fca5a5",
  },
};

// Palette de styles partagée par toutes les vues du Panel Super-Admin.
// Quelques entrées sont des fonctions (badge(actif), btn(color,bg))
// pour générer un style selon le contexte.
export const S_STYLES = {
  page: {padding:"28px 32px",fontFamily:"'Segoe UI',system-ui,sans-serif",minHeight:"100vh",background:"#f4f7fb"},
  titre: {margin:"0 0 6px",fontSize:22,fontWeight:900,color:C.blueDark},
  sous: {margin:"0 0 24px",fontSize:12,color:"#9ca3af"},
  card: {background:"#fff",borderRadius:14,boxShadow:"0 2px 16px rgba(0,32,80,0.08)",overflow:"hidden"},
  th: {padding:"10px 14px",fontSize:11,fontWeight:700,color:"#6b7280",textTransform:"uppercase",letterSpacing:"0.05em",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",textAlign:"left"},
  td: {padding:"12px 14px",fontSize:13,color:"#374151",borderBottom:"1px solid #f0f0f0",verticalAlign:"middle"},
  badge: (actif) => ({
    display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:700,
    background:actif?"#d1fae5":"#fee2e2",color:actif?"#065f46":"#991b1b",
  }),
  btn: (color,bg) => ({background:bg||color,color:color===C.blue?"#fff":color===C.green?"#fff":"#fff",border:"none",padding:"5px 12px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer"}),
  input: {border:"1px solid #d1d5db",borderRadius:8,padding:"8px 12px",fontSize:13,outline:"none",boxSizing:"border-box"},
  overlay: {position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center"},
  modal: {background:"#fff",borderRadius:16,padding:"28px 32px",width:"100%",maxWidth:440,boxShadow:"0 20px 60px rgba(0,0,0,0.25)"},
};
