import { useContext, useState, useEffect } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import {
  computeDateExpiration,
  daysUntilExpiration,
  getComplianceStatus,
  legalProfileMock,
  updateLegalProfile,
} from "../../legal-utils";

// État et logique du widget Conformité. La source de vérité est
// `schoolInfo.legal` (listener posé dans App.jsx) ; retombe sur
// `legalProfileMock` tant que le doc Firestore n'existe pas.
export function useComplianceWidget(profileOverride) {
  const { schoolId, schoolInfo } = useContext(SchoolContext);
  const source = profileOverride || schoolInfo?.legal || legalProfileMock;
  const [profile, setProfile] = useState(source);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Si la source Firestore change pendant que la modale est fermée,
  // on resynchronise l'état local avec le snapshot.
  useEffect(() => {
    if (!modalOpen) setProfile(source);
  }, [source, modalOpen]);

  const status = getComplianceStatus(profile);
  const days = daysUntilExpiration(profile);
  const expDate = computeDateExpiration(profile);

  const openModal = () => setModalOpen(true);
  const closeModal = () => { if (!saving) { setError(""); setModalOpen(false); } };

  const save = async (next) => {
    if (!schoolId) {
      setError("schoolId manquant — impossible de sauvegarder.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateLegalProfile(schoolId, next);
      setProfile(next);
      setModalOpen(false);
    } catch (e) {
      setError(e?.message || "Échec de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  return { schoolInfo, profile, modalOpen, saving, error, status, days, expDate, openModal, closeModal, save };
}
