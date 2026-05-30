import { useState, useEffect, useRef, useMemo, useContext } from "react";
import { SchoolContext } from "../../contexts/SchoolContext";
import { useFirestore } from "../../hooks/useFirestore";

// Logique de la recherche globale (Ctrl+K) : agrégation élèves/enseignants/modules,
// navigation clavier et ouverture de fiche détaillée.
export function useRechercheGlobale({ modules, onNaviguer, onFermer }) {
  const { moisAnnee } = useContext(SchoolContext);
  const { items: elevesC } = useFirestore("elevesCollege");
  const { items: elevesP } = useFirestore("elevesPrimaire");
  const { items: elevesL } = useFirestore("elevesLycee");
  const { items: ensP } = useFirestore("ensPrimaire");
  const { items: ensC } = useFirestore("ensCollege");
  const { items: ensL } = useFirestore("ensLycee");
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const [selIdx, setSelIdx] = useState(0);
  const [fiche, setFiche] = useState(null); // {type:"élève"|"enseignant", data, section}

  useEffect(() => { if (!fiche) inputRef.current?.focus(); }, [fiche]);

  const q2 = q.trim().toLowerCase();

  const resultats = useMemo(() => {
    if (q2.length < 2) return modules.map(m => ({ type: "module", label: m.label, sub: m.desc, icon: m.icon, data: null, section: m.id }));
    const r = [];
    modules.filter(m => m.label.toLowerCase().includes(q2) || m.desc.toLowerCase().includes(q2))
      .forEach(m => r.push({ type: "module", label: m.label, sub: m.desc, icon: m.icon, data: null, section: m.id }));
    [...elevesC, ...elevesP, ...elevesL].filter(e =>
      `${e.nom} ${e.prenom} ${e.matricule || ""} ${e.classe || ""} ${e.ien || ""}`.toLowerCase().includes(q2)
    ).slice(0, 8).forEach(e => {
      const section = elevesC.find(x => x._id === e._id) ? "college"
        : elevesL.find(x => x._id === e._id) ? "lycee" : "primaire";
      r.push({ type: "élève", label: `${e.nom} ${e.prenom}`, sub: `${e.classe || ""} · ${e.matricule || "—"}`, icon: "🎓", data: e, section });
    });
    [...ensP, ...ensC, ...ensL].filter(e =>
      `${e.nom} ${e.prenom || ""} ${e.matiere || ""} ${e.contact || ""}`.toLowerCase().includes(q2)
    ).slice(0, 5).forEach(e => {
      const section = ensP.find(x => x._id === e._id) ? "primaire"
        : ensL.find(x => x._id === e._id) ? "lycee" : "college";
      r.push({ type: "enseignant", label: `${e.nom}${e.prenom ? " " + e.prenom : ""}`, sub: e.matiere || "Enseignant", icon: "👨‍🏫", data: e, section });
    });
    return r;
  }, [q2, modules, elevesC, elevesP, elevesL, ensP, ensC, ensL]);

  const executer = (res) => {
    if (!res) return;
    if (res.type === "module") { onNaviguer(res.section); onFermer(); return; }
    setFiche(res); // afficher la fiche détaillée
  };

  const onKey = (e) => {
    if (fiche) { if (e.key === "Escape") { setFiche(null); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSelIdx(i => Math.min(i + 1, resultats.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter") { e.preventDefault(); executer(resultats[selIdx]); }
    if (e.key === "Escape") { onFermer(); }
  };

  return { moisAnnee, q, setQ, inputRef, selIdx, setSelIdx, fiche, setFiche, resultats, executer, onKey };
}
