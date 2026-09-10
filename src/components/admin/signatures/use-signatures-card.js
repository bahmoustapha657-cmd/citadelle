import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { chargerPostes } from "../../../backend/account-manage-supabase";
import { sauverParametresEcole } from "../../../backend/data-supabase";
import { subscribeTable } from "../../../backend/realtime-supabase";
import { compacterMatrice, normaliserMatrice, signatairesDocument } from "../../../reports/signatures";

// Logique de la carte « Qui signe quoi » : postes de l'école (temps réel),
// brouillon de la matrice, aperçu de ce que chaque document imprimera.
export function useSignaturesCard({ schoolId, toast }) {
  const { schoolInfo, setSchoolInfo } = useContext(SchoolContext);
  const [postes, setPostes] = useState([]);
  // Tant que les postes ne sont pas là, la matrice n'est pas affichée : chaque
  // réglage passerait sinon pour un « poste supprimé ».
  const [chargement, setChargement] = useState(true);
  const [brouillon, setBrouillon] = useState(null); // null : rien de modifié
  const [enregistrement, setEnregistrement] = useState(false);

  const recharger = useCallback(async () => {
    try {
      setPostes(await chargerPostes(schoolId));
    } catch (e) {
      toast(e.message || "Chargement des postes impossible.", "error");
    } finally {
      setChargement(false);
    }
  }, [schoolId, toast]);

  useEffect(() => { recharger(); }, [recharger]);
  // Un poste créé, renommé ou supprimé change les choix possibles.
  useEffect(() => subscribeTable(schoolId, "postes", recharger), [schoolId, recharger]);

  const enregistree = useMemo(() => normaliserMatrice(schoolInfo?.signatures), [schoolInfo?.signatures]);
  const matrice = brouillon || enregistree;
  const modifie = !!brouillon
    && JSON.stringify(compacterMatrice(brouillon)) !== JSON.stringify(compacterMatrice(enregistree));

  // La table `postes` fait foi : l'aperçu montre les libellés et responsables
  // tels qu'ils y sont, même si l'école ne les a pas encore recopiés.
  const libellesPostes = useMemo(
    () => Object.fromEntries(postes.map((p) => [p.cle, p.label])),
    [postes],
  );
  const infoApercu = useMemo(() => ({
    ...schoolInfo,
    signatures: compacterMatrice(matrice),
    libellesPostes,
    responsables: {
      ...(schoolInfo?.responsables || {}),
      ...Object.fromEntries(postes.filter((p) => p.responsable).map((p) => [p.cle, p.responsable])),
    },
  }), [schoolInfo, matrice, libellesPostes, postes]);

  const apercu = (docId, section) => signatairesDocument(infoApercu, docId, { section });

  const choisir = (docId, emplacement, valeur) => setBrouillon((prec) => {
    const base = prec || enregistree;
    return { ...base, [docId]: { ...base[docId], [emplacement]: valeur || null } };
  });

  const retablir = () => setBrouillon(normaliserMatrice({}));
  const annuler = () => setBrouillon(null);

  const enregistrer = async () => {
    const signatures = compacterMatrice(matrice);
    setEnregistrement(true);
    try {
      // Les libellés de TOUS les postes sont recopiés au passage : les écoles
      // antérieures à la matrice n'en avaient aucun, et un poste renommé dans
      // Comptes & Postes porte désormais son nom sur les documents.
      await sauverParametresEcole(schoolId, { signatures, libellesPostes });
      setSchoolInfo((prec) => ({ ...prec, signatures, libellesPostes }));
      setBrouillon(null);
      toast("Qui signe quoi : réglage enregistré.", "success");
    } catch (e) {
      toast(e.message || "Enregistrement impossible.", "error");
    } finally {
      setEnregistrement(false);
    }
  };

  return { postes, chargement, matrice, modifie, apercu, choisir, retablir, annuler, enregistrer, enregistrement };
}
