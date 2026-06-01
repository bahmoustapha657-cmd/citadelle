import { useState, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { getAnnee, today } from "../../constants";
import { getAnnualAverage, getSubjectAverage } from "../../note-utils";
import { getPeriodesForSection } from "../../period-utils";

// Logique des livrets scolaires : chargement, dérivations et opérations
// (création, pré-remplissage annuel, sauvegarde et signature d'une année).
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

  // Génère un numéro de livret
  const genNumeroLivret = () => {
    const an = getAnnee().split("-")[0].slice(-2);
    const nums = livrets.map(l => parseInt((l.numeroLivret || "").replace(/[^0-9]/g, "")) || 0);
    const n = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `LIV-${an}-${String(n).padStart(4, "0")}`;
  };

  // Crée ou ouvre le livret d'un élève
  const ouvrirLivret = async (eleve) => {
    const existing = livrets.find(l => l.eleveId === eleve._id);
    if (existing) { setLivretSelId(existing._id); return; }
    if (!canEdit) { toast("Création réservée à la direction/admin.", "warning"); return; }
    setSavingL(true);
    try {
      const id = await ajLivret({
        eleveId: eleve._id,
        eleveNom: `${eleve.nom} ${eleve.prenom}`,
        matricule: eleve.matricule || "",
        ien: eleve.ien || "",
        dateNaissance: eleve.dateNaissance || "",
        lieuNaissance: eleve.lieuNaissance || "",
        photo: eleve.photo || "",
        section,
        numeroLivret: genNumeroLivret(),
        dateCreation: new Date().toISOString().slice(0, 10),
        annees: [],
        annee: annee || getAnnee(),
      });
      setLivretSelId(id);
      toast("Livret créé", "success");
    } finally { setSavingL(false); }
  };

  // Pré-remplit une nouvelle entrée annuelle depuis les notes actuelles
  const preRemplirAnnee = (eleve) => {
    const notesEleve = notes.filter(n => n.eleveId === eleve._id);
    const matieresList = matieres.map(mat => {
      const notesParPeriode = periodes.reduce((acc, p) => {
        const ns = notesEleve.filter(n => n.matiere === mat.nom && n.periode === p);
        acc[p] = getSubjectAverage(ns, eleve.classe, section);
        return acc;
      }, {});
      // Moyenne annuelle par matière : diviseur fixe au nombre de périodes
      // (3 trimestres, 2 semestres ou 9 mois), périodes vides comptées 0.
      const ann = getAnnualAverage(periodes.map((p) => notesParPeriode[p]));
      return {
        matiere: mat.nom, coef: mat.coefficient || 1, maxNote,
        ...notesParPeriode,
        annuelle: ann,
      };
    });
    return {
      anneeScolaire: annee || getAnnee(),
      classe: eleve.classe || "",
      enseignantPrincipal: "",
      notes: matieresList,
      absences: { justifiees: 0, nonJustifiees: 0 },
      rang: "", effectifClasse: eleves.filter(e => e.classe === eleve.classe).length,
      appreciation: "", decision: "Admis",
      signe: false, dateSigne: null,
    };
  };

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
