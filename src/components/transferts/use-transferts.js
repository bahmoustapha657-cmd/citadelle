import { useCallback, useContext, useEffect, useState } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { genererMatricule, getAnnee, getClassesForSection, getSystemeScolaire } from "../../constants";
import { situationAuDepart } from "./situation-depart";
import { classesAccueil, dossierTransfert, normaliserToken } from "./dossier-transfert";
import { apiAccepterTransfert, apiGenererToken, apiListerTransferts, apiVerifierToken } from "./transferts-api";

// État et logique du panneau de transferts : datasets élèves/tarifs, sous-onglet
// courant, et les appels API (génération/vérification/acceptation de token).
// Les appels réseau bruts vivent dans transferts-api.js.
export function useTransferts({ userRole }) {
  const { schoolId, schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const { items: elevesC } = useFirestore("elevesCollege");
  const { items: elevesP } = useFirestore("elevesPrimaire");
  const { items: elevesL } = useFirestore("elevesLycee");
  const { items: elevesPre } = useFirestore("elevesPrescolaire");
  const { items: tarifsClasses } = useFirestore("tarifs");
  const canEdit = !["enseignant"].includes(userRole);
  const anneeOfficielle = schoolInfo?.anneeScolaire || getAnnee();

  const [sousTab, setSousTab] = useState("sortants"); // sortants | entrants
  const [modalSortant, setModalSortant] = useState(null);
  const [tokenInput, setTokenInput] = useState("");
  const [transfertData, setTransfertData] = useState(null);
  const [classeAccueil, setClasseAccueil] = useState("");
  const [loading, setLoading] = useState(false);
  const [transfertsSortants, setTransfertsSortants] = useState([]);

  const elevesParSection = { college: elevesC, lycee: elevesL, primaire: elevesP, prescolaire: elevesPre };
  const tousEleves = [...elevesC, ...elevesP, ...elevesL, ...elevesPre];
  const partis = tousEleves.filter((e) => e.statut === "Transféré");

  // Ce que certifient les documents de sortie : l'année réellement faite en
  // dernier, la classe d'alors et le solde de cette année-là.
  const situation = (eleve) => situationAuDepart(eleve, { moisAnnee, tarifsClasses, anneeOfficielle });

  // Tokens déjà émis, relus depuis la base : ils survivent au rechargement.
  const chargerSortants = useCallback(async () => {
    try {
      const data = await apiListerTransferts();
      if (Array.isArray(data?.transferts)) setTransfertsSortants(data.transferts);
    } catch {
      // Hors ligne : la liste se rechargera à la prochaine ouverture.
    }
  }, []);
  useEffect(() => { chargerSortants(); }, [chargerSortants]);

  // Génère un token de transfert.
  const genererToken = async (eleve, ecoleDestination) => {
    setLoading(true);
    try {
      const eleveSnapshot = dossierTransfert(eleve, { schoolNom: schoolInfo.nom || "", solde: situation(eleve).solde });
      const data = await apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination });
      if (data.token) {
        setTransfertsSortants((prev) => [{
          token: data.token, statut: "en_attente", createdAt: data.createdAt || new Date().toISOString(),
          ecoleDestination: ecoleDestination || "", eleveId: eleve._id,
        }, ...prev]);
        toast("Token de transfert généré", "success");
        setModalSortant({ ...eleve, token: data.token, ecoleDestination });
      } else {
        toast(data.error || "Erreur lors de la génération", "error");
      }
    } catch (e) {
      toast("Erreur réseau : " + e.message, "error");
    } finally { setLoading(false); }
  };

  // Classes proposées pour accueillir l'élève : celles de sa section déjà
  // utilisées ici, puis la liste type du système de l'école.
  const classesPourSection = (section) => {
    const existantes = [...new Set((elevesParSection[section] || []).map((e) => e.classe).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b), "fr", { numeric: true }));
    return classesAccueil(existantes, getClassesForSection(section, getSystemeScolaire(schoolInfo)));
  };

  // Vérifie un token entrant.
  const verifierToken = async () => {
    if (!tokenInput.trim()) { toast("Saisissez un token", "warning"); return; }
    const token = normaliserToken(tokenInput);
    if (!token) { toast("Ce code n'a pas le format d'un token EduGest.", "warning"); return; }
    setLoading(true);
    try {
      const data = await apiVerifierToken(token);
      if (data.eleveSnapshot) {
        setTransfertData(data);
        // Même classe que dans l'école d'origine, si l'école d'accueil l'a.
        const classe = data.eleveSnapshot.classe || "";
        setClasseAccueil(classesPourSection(data.eleveSnapshot.section).includes(classe) ? classe : "");
      } else {
        toast(data.error || "Token introuvable ou expiré", "error");
      }
    } catch (e) {
      toast("Erreur réseau : " + e.message, "error");
    } finally { setLoading(false); }
  };

  // Matricule attribué à l'accueil : la numérotation de CETTE école, pas celle
  // de l'école d'origine (deux écoles peuvent émettre le même « P26-012 »).
  const sectionAccueil = transfertData?.eleveSnapshot?.section || "";
  const matriculeAccueil = sectionAccueil
    ? genererMatricule(elevesParSection[sectionAccueil] || [], sectionAccueil, schoolInfo)
    : "";

  // Accepte un transfert entrant : crée la fiche, identité seule.
  const accepterTransfert = async () => {
    if (!transfertData) return;
    if (!classeAccueil) { toast("Choisissez la classe d'accueil.", "warning"); return; }
    setLoading(true);
    try {
      const data = await apiAccepterTransfert({
        token: normaliserToken(tokenInput), targetSchoolId: schoolId,
        classe: classeAccueil, matricule: matriculeAccueil,
      });
      if (data.ok) {
        const snap = transfertData.eleveSnapshot || {};
        toast(`${snap.prenom || ""} ${snap.nom || ""} accueilli(e) en ${classeAccueil} (matricule ${matriculeAccueil})`, "success");
        setTransfertData(null); setTokenInput(""); setClasseAccueil("");
      } else {
        toast(data.error || "Erreur lors de l'acceptation", "error");
      }
    } catch (e) {
      toast("Erreur réseau : " + e.message, "error");
    } finally { setLoading(false); }
  };

  return {
    schoolInfo, toast, canEdit,
    sousTab, setSousTab,
    modalSortant, setModalSortant,
    tokenInput, setTokenInput,
    transfertData,
    classeAccueil, setClasseAccueil, classesPourSection, matriculeAccueil,
    loading,
    transfertsSortants,
    partis,
    situation,
    genererToken, verifierToken, accepterTransfert,
  };
}
