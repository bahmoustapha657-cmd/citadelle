import { useState, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";
import { C } from "../../constants";
import { getActiveExamForms, resolveCanonicalExamType } from "../../evaluation-forms";
import { imprimerConvocations } from "./convocations-print";

// État et logique de la gestion des examens : datasets, formulaire de
// planification, filtres, regroupement à venir/passés, et impression des
// convocations.
export function useExamens() {
  const { schoolInfo, toast } = useContext(SchoolContext);
  const { items: examens, ajouter: ajEx, modifier: modEx, supprimer: supEx } = useFirestore("examens");
  const { items: elevesC } = useFirestore("elevesCollege");
  const { items: elevesP } = useFirestore("elevesPrimaire");
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;
  const examForms = getActiveExamForms(schoolInfo);
  const defaultExamType = examForms[0]?.value || "Composition";
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [filtre, setFiltre] = useState("all");
  const chg = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const tousEleves = [...elevesC, ...elevesP];
  const classes = [...new Set(tousEleves.map(e => e.classe || ""))].filter(Boolean).sort();

  const examensFiltres = filtre === "all" ? examens : examens.filter(e => e.classe === filtre || e.classe === "Toutes");
  const examensTries = [...examensFiltres].sort((a, b) => a.date > b.date ? 1 : -1);

  const today = new Date().toISOString().slice(0, 10);
  const aVenir = examensTries.filter(e => !e.date || e.date >= today);
  const passes = examensTries.filter(e => e.date && e.date < today);

  const genererConvocations = (exam) => imprimerConvocations(exam, tousEleves, schoolInfo);

  const saveExam = () => {
    if (!form.titre) { toast("Titre requis", "warning"); return; }
    const row = { ...form, type: resolveCanonicalExamType(form.type || defaultExamType, schoolInfo) };
    modal === "add" ? ajEx(row) : modEx(row);
    setModal(null);
    toast(modal === "add" ? "Examen planifié" : "Examen mis à jour", "success");
  };

  return {
    schoolInfo, examens, c1, c2, examForms, defaultExamType,
    modal, setModal, form, setForm, filtre, setFiltre, chg,
    classes, aVenir, passes,
    genererConvocations, saveExam, supEx,
  };
}
