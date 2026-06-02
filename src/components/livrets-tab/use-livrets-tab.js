import { useState, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { today } from "../../constants";
import { getPeriodesForSection } from "../../period-utils";
import { genNumeroLivret, buildNouveauLivret, buildAnneePreRemplie } from "./livrets-logic";

// Logique des livrets scolaires : chargement, dérivations et opérations
// (création, pré-remplissage annuel, sauvegarde et signature d'une année).
// Les constructeurs purs vivent dans livrets-logic.js.
export function useLivretsTab({ cleEleves, cleNotes, matieres, maxNote, userRole, annee }) {
  const { schoolInfo, toast } = useContext(SchoolContext);
  const { items: livrets, ajouter: ajLivret, modifier: modLivret } = useFirestore("livrets");
  const { items: eleves } = useFirestore(cleEleves);
  const { items: notes } = useFirestore(cleNotes);
  const section = cleEleves.includes("Primaire") ? "primaire" : cleEleves.includes("Lycee") ? "lycee" : "college";
  const canEdit = ["direction", "admin", "comptable"].includes(userRole);
  const periodes = getPeriodesForSection(schoolInfo, section === "primaire" ? "primaire" : "secondaire");

  const [livretSelId, setLivretSelId] = useState(null);
  const [filtreClasse, setFiltreClasse] = useState("all");
  const [modal, setModal] = useState(null); // "annee"
  const [formAnnee, setFormAnnee] = useState({});
  const [savingL, setSavingL] = useState(false);

  const classesUniq = [...new Set(eleves.map(e => e.classe))].filter(Boolean).sort();
  const elevesFiltr = filtreClasse === "all" ? eleves : eleves.filter(e => e.classe === filtreClasse);
  const livretSel = livrets.find(l => l._id === livretSelId);

  // Crée ou ouvre le livret d'un élève
  const ouvrirLivret = async (eleve) => {
    const existing = livrets.find(l => l.eleveId === eleve._id);
    if (existing) { setLivretSelId(existing._id); return; }
    if (!canEdit) { toast("Création réservée à la direction/admin.", "warning"); return; }
    setSavingL(true);
    try {
      const id = await ajLivret(buildNouveauLivret(eleve, { section, numeroLivret: genNumeroLivret(livrets), annee }));
      setLivretSelId(id);
      toast("Livret créé", "success");
    } finally { setSavingL(false); }
  };

  const preRemplirAnnee = (eleve) =>
    buildAnneePreRemplie(eleve, { notes, matieres, periodes, section, maxNote, eleves, annee });

  const sauvegarderAnnee = async () => {
    if (!livretSel) return;
    setSavingL(true);
    try {
      const annees = [...(livretSel.annees || [])];
      if (formAnnee._idx != null) annees[formAnnee._idx] = { ...formAnnee, _idx: undefined };
      else annees.push({ ...formAnnee });
      await modLivret(livretSel._id, { annees });
      setModal(null);
      toast("Année enregistrée", "success");
    } finally { setSavingL(false); }
  };

  const signerAnnee = async (livretId, idx) => {
    const lv = livrets.find(l => l._id === livretId);
    if (!lv) return;
    const annees = [...lv.annees];
    annees[idx] = { ...annees[idx], signe: true, dateSigne: today() };
    await modLivret(livretId, { annees });
    toast("Année signée et verrouillée", "success");
  };

  const chgAnnee = k => e => setFormAnnee(p => ({ ...p, [k]: e.target.value }));
  const chgAbs = k => e => setFormAnnee(p => ({ ...p, absences: { ...(p.absences || {}), [k]: Number(e.target.value) } }));

  return {
    schoolInfo, livrets, eleves, periodes, maxNote, canEdit,
    livretSelId, setLivretSelId, filtreClasse, setFiltreClasse,
    modal, setModal, formAnnee, setFormAnnee, savingL,
    classesUniq, elevesFiltr, livretSel,
    ouvrirLivret, preRemplirAnnee, sauvegarderAnnee, signerAnnee, chgAnnee, chgAbs,
  };
}
