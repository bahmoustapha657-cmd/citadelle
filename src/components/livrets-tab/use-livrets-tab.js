import { useState, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { today } from "../../constants";
import {
  genNumeroLivret, buildNouveauLivret, buildAnneePreRemplie, anneesApresSaisie, anneesApresSignature,
} from "./livrets-logic";

// Logique des livrets scolaires : chargement, dérivations et opérations
// (création, pré-remplissage annuel, sauvegarde et signature d'une année).
// Les constructeurs purs vivent dans livrets-logic.js.
// `section` et `periodes` sont ceux du module École : la section était
// jusqu'ici déduite du nom de collection, et la maternelle tombait dans
// « college » — périodicité du secondaire et moyennes du secondaire
// (Cours + 2 × Composition) sur ses livrets, alors que ses bulletins font une
// moyenne simple.
export function useLivretsTab({ section, periodes, cleEleves, cleNotes, matieres, maxNote, userRole, annee }) {
  const { schoolInfo, toast } = useContext(SchoolContext);
  // modifierChamp(id, champs) : mise à jour partielle, fusionnée dans le jsonb `extra`.
  // (`modifier` attend un item complet portant `_id` : appelé en (id, champs), il n'écrit rien.)
  const { items: livrets, ajouter: ajLivret, modifierChamp: modLivret } = useFirestore("livrets");
  const { items: eleves } = useFirestore(cleEleves);
  const { items: notes } = useFirestore(cleNotes);
  const canEdit = ["direction", "admin", "comptable"].includes(userRole);

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
      // `ajouter` renvoie le livret créé (sa référence en Firebase), pas son id.
      const cree = await ajLivret(buildNouveauLivret(eleve, { section, numeroLivret: genNumeroLivret(livrets), annee }));
      setLivretSelId(cree.id);
      toast("Livret créé", "success");
    } finally { setSavingL(false); }
  };

  const preRemplirAnnee = (eleve) =>
    buildAnneePreRemplie(eleve, { notes, matieres, periodes, section, maxNote, eleves, annee });

  const sauvegarderAnnee = async () => {
    if (!livretSel) return;
    setSavingL(true);
    try {
      await modLivret(livretSel._id, { annees: anneesApresSaisie(livretSel.annees, formAnnee) });
      setModal(null);
      toast("Année enregistrée", "success");
    } finally { setSavingL(false); }
  };

  const signerAnnee = async (livretId, idx) => {
    const lv = livrets.find(l => l._id === livretId);
    if (!lv) return;
    await modLivret(livretId, { annees: anneesApresSignature(lv.annees, idx, today()) });
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
