// ══════════════════════════════════════════════════════════════
//  Pages chargées en lazy (code-splitting du shell App)
// ══════════════════════════════════════════════════════════════
import { lazy } from "react";

const lazyNamedExport = (loader, exportName) =>
  lazy(() => loader().then((module) => ({ default: module[exportName] })));

export const Inscription = lazy(() => import("../../Inscription"));
export const Connexion = lazyNamedExport(() => import("../Connexion"), "Connexion");
export const RechercheGlobale = lazyNamedExport(() => import("../RechercheGlobale"), "RechercheGlobale");
export const PortailPublic = lazyNamedExport(() => import("../PortailPublic"), "PortailPublic");
export const ChangerMotDePasseModal = lazyNamedExport(() => import("../ChangerMotDePasseModal"), "ChangerMotDePasseModal");
export const PortailEnseignant = lazyNamedExport(() => import("../PortailEnseignant"), "PortailEnseignant");
export const PortailParent = lazyNamedExport(() => import("../PortailParent"), "PortailParent");
export const SuperAdminPanel = lazy(() => import("../SuperAdminPanel"));
export const TableauDeBord = lazyNamedExport(() => import("../TableauDeBord"), "TableauDeBord");
export const HistoriqueActions = lazyNamedExport(() => import("../HistoriqueActions"), "HistoriqueActions");
export const ParametresEcole = lazyNamedExport(() => import("../ParametresEcole"), "ParametresEcole");
export const AdminPanel = lazyNamedExport(() => import("../AdminPanel"), "AdminPanel");
export const Fondation = lazyNamedExport(() => import("../Fondation"), "Fondation");
export const Comptabilite = lazyNamedExport(() => import("../Comptabilite"), "Comptabilite");
export const Ecole = lazyNamedExport(() => import("../Ecole"), "Ecole");
export const Secondaire = lazyNamedExport(() => import("../Secondaire"), "Secondaire");
export const Calendrier = lazyNamedExport(() => import("../Calendrier"), "Calendrier");
export const GestionExamens = lazyNamedExport(() => import("../GestionExamens"), "GestionExamens");
export const MessagesParents = lazyNamedExport(() => import("../MessagesParents"), "MessagesParents");
export const MessagesEcole = lazy(() => import("../MessagesEcole"));
export const LandingEduGest = lazyNamedExport(() => import("../LandingEduGest"), "LandingEduGest");
export const DemoEduGest = lazyNamedExport(() => import("../DemoEduGest"), "DemoEduGest");
