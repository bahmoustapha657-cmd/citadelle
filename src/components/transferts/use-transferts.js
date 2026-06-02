import { useState, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { today } from "../../constants";
import { getEleveSolde } from "../../mensualite-utils";
import { apiGenererToken, apiVerifierToken, apiAccepterTransfert } from "./transferts-api";

// État et logique du panneau de transferts : datasets élèves/tarifs, sous-onglet
// courant, et les appels API (génération/vérification/acceptation de token).
// Les appels réseau bruts vivent dans transferts-api.js.
export function useTransferts({ userRole }) {
  const { schoolId, schoolInfo, moisAnnee, toast } = useContext(SchoolContext);
  const { items: elevesC } = useFirestore("elevesCollege");
  const { items: elevesP } = useFirestore("elevesPrimaire");
  const { items: elevesL } = useFirestore("elevesLycee");
  const { items: tarifsClasses } = useFirestore("tarifs");
  const canEdit = !["enseignant"].includes(userRole);

  const [sousTab, setSousTab] = useState("sortants"); // sortants | entrants
  const [modalSortant, setModalSortant] = useState(null);
  const [tokenInput, setTokenInput] = useState("");
  const [transfertData, setTransfertData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transfertsSortants, setTransfertsSortants] = useState([]);

  const tousEleves = [...elevesC, ...elevesP, ...elevesL];
  const partis = tousEleves.filter(e => ["Transféré"].includes(e.statut));

  const getSolde = (eleve) => getEleveSolde(eleve, moisAnnee, tarifsClasses);

  // Génère un token de transfert (Phase 2)
  const genererToken = async (eleve, ecoleDestination) => {
    setLoading(true);
    try {
      const eleveSnapshot = { ...eleve, schoolNom: schoolInfo.nom || "", solde: getSolde(eleve) };
      const data = await apiGenererToken({ schoolId, eleveSnapshot, ecoleDestination });
      if (data.token) {
        setTransfertsSortants(prev => [{ ...data, eleveNom: `${eleve.nom} ${eleve.prenom}`, classe: eleve.classe, dateCreation: today() }, ...prev]);
        toast(`Token généré : ${data.token}`, "success");
        setModalSortant({ ...eleve, token: data.token, ecoleDestination });
      } else {
        toast(data.error || "Erreur lors de la génération", "error");
      }
    } catch (e) {
      toast("Erreur réseau : " + e.message, "error");
    } finally { setLoading(false); }
  };

  // Vérifie un token entrant (Phase 2)
  const verifierToken = async () => {
    if (!tokenInput.trim()) { toast("Saisissez un token", "warning"); return; }
    setLoading(true);
    try {
      const data = await apiVerifierToken(tokenInput.trim());
      if (data.eleveSnapshot) setTransfertData(data);
      else toast(data.error || "Token introuvable ou expiré", "error");
    } catch (e) {
      toast("Erreur réseau : " + e.message, "error");
    } finally { setLoading(false); }
  };

  // Accepte un transfert entrant et importe l'élève
  const accepterTransfert = async () => {
    if (!transfertData) return;
    setLoading(true);
    try {
      const data = await apiAccepterTransfert({ token: tokenInput, targetSchoolId: schoolId });
      if (data.ok) {
        toast("Élève importé avec succès", "success");
        setTransfertData(null); setTokenInput("");
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
    loading,
    transfertsSortants,
    partis,
    getSolde,
    genererToken, verifierToken, accepterTransfert,
  };
}
