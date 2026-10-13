import { useContext, useMemo, useState } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { getSectionLabel } from "../../../constants";
import { Btn, Modale, Selec } from "../../ui";
import {
  appliquerPasserelle, classeArriveeValide, classesArrivee, elevesPasserelle, sectionSuivante, sectionsPasserelle,
} from "./passerelle";

// Passerelle manuelle entre sections : on choisit la section de départ (par
// défaut le préscolaire) et d'arrivée (le primaire), on filtre par classe, on
// coche les élèves et on choisit leur nouvelle classe.
export function PasserelleModale({ setModal, schoolId, schoolInfo, toast, elevesParNiveau, classesParNiveau = {}, rechargerParNiveau = {} }) {
  const { logAction } = useContext(SchoolContext);
  const sections = sectionsPasserelle(schoolInfo);
  const [depart, setDepartBrut] = useState(() => (sections.includes("prescolaire") ? "prescolaire" : sections[0]));
  const [arrivee, setArriveeBrut] = useState(() => sectionSuivante(schoolInfo, depart));
  const [filtre, setFiltre] = useState("all");
  const [coches, setCoches] = useState(() => new Set());
  const [classeChoisie, setClasse] = useState("");
  const [enCours, setEnCours] = useState(false);

  const eleves = useMemo(() => elevesPasserelle(elevesParNiveau[depart] || []), [elevesParNiveau, depart]);
  const classesDepart = useMemo(() => [...new Set(eleves.map((e) => e.classe).filter(Boolean))], [eleves]);
  const visibles = filtre === "all" ? eleves : eleves.filter((e) => e.classe === filtre);
  const arrivees = useMemo(() => classesArrivee(schoolInfo, arrivee, [
    ...(classesParNiveau[arrivee] || []),
    ...(elevesParNiveau[arrivee] || []).map((e) => e.classe),
  ]).sort((a, b) => a.localeCompare(b, "fr", { numeric: true })), [schoolInfo, arrivee, classesParNiveau, elevesParNiveau]);
  // Classe retenue : le choix s'il est valable pour la section, sinon la première.
  const classe = arrivees.includes(classeChoisie) ? classeChoisie : (arrivees[0] || "");
  const choisis = eleves.filter((e) => coches.has(e._id));

  const setDepart = (s) => {
    setDepartBrut(s);
    setFiltre("all");
    setCoches(new Set());
    if (s === arrivee) setArriveeBrut(sectionSuivante(schoolInfo, s));
  };
  const setArrivee = (s) => { setArriveeBrut(s); setClasse(""); };

  const basculer = (id) => setCoches((prec) => {
    const s = new Set(prec);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });
  const tousCoches = visibles.length > 0 && visibles.every((e) => coches.has(e._id));
  const basculerTous = () => setCoches((prec) => {
    const s = new Set(prec);
    visibles.forEach((e) => (tousCoches ? s.delete(e._id) : s.add(e._id)));
    return s;
  });

  const appliquer = async () => {
    if (!choisis.length || !classeArriveeValide(classe, arrivee) || depart === arrivee) return;
    if (!confirm(
      `Faire passer ${choisis.length} élève(s) du ${getSectionLabel(depart)} en « ${classe} » (${getSectionLabel(arrivee)}) ?\n\n`
      + choisis.slice(0, 15).map((e) => `• ${e.nom} ${e.prenom} (${e.classe})`).join("\n")
      + (choisis.length > 15 ? `\n… et ${choisis.length - 15} autre(s)` : ""),
    )) return;
    setEnCours(true);
    try {
      const { passes, echecs } = await appliquerPasserelle(schoolId, choisis, { depart, arrivee, classe });
      if (passes.length) {
        logAction?.(
          `Passerelle ${getSectionLabel(depart)} → ${getSectionLabel(arrivee)}`,
          `${passes.length} élève(s) passé(s) en ${classe} : `
          + passes.map((e) => `${e.nom} ${e.prenom} (${e.classe})`).join(", "),
        );
      }
      await Promise.all([rechargerParNiveau[depart]?.(), rechargerParNiveau[arrivee]?.()]);
      setCoches(new Set(echecs.map((x) => x.eleve._id)));
      if (echecs.length) {
        toast(`${passes.length} passé(s), ${echecs.length} échec(s) : ${echecs[0].erreur}`, "error");
      } else {
        toast(`${passes.length} élève(s) passé(s) en ${classe}`, "success");
      }
    } catch (e) {
      toast("Erreur lors du passage : " + e.message, "error");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modale titre="🌉 Passerelle entre sections" fermer={() => setModal(null)} large>
      <p style={{margin:"0 0 14px",fontSize:12,color:"#6b7280"}}>
        Faites passer à la main les élèves de votre choix dans une autre section (ex. Grande Section → 1ère Année),
        à tout moment de l'année. L'élève garde sa fiche, son matricule et ses paiements ; ses notes restent dans
        sa section de départ. Sa scolarité suit désormais le tarif de sa nouvelle classe.
      </p>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginBottom:12}}>
        <Selec label="Section de départ" value={depart} onChange={(ev) => setDepart(ev.target.value)}>
          {sections.map((s) => <option key={s} value={s}>{getSectionLabel(s)} ({elevesPasserelle(elevesParNiveau[s] || []).length})</option>)}
        </Selec>
        <Selec label="Classe de départ" value={filtre} onChange={(ev) => setFiltre(ev.target.value)}>
          <option value="all">Toutes les classes ({eleves.length})</option>
          {classesDepart.map((c) => (
            <option key={c} value={c}>{c} ({eleves.filter((e) => e.classe === c).length})</option>
          ))}
        </Selec>
        <Selec label="Section d'arrivée" value={arrivee} onChange={(ev) => setArrivee(ev.target.value)}>
          {sections.filter((s) => s !== depart).map((s) => <option key={s} value={s}>{getSectionLabel(s)}</option>)}
        </Selec>
        <Selec label="Classe d'arrivée" value={classe} onChange={(ev) => setClasse(ev.target.value)}>
          {arrivees.map((c) => <option key={c} value={c}>{c}</option>)}
        </Selec>
      </div>

      {visibles.length === 0 ? (
        <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
          Aucun élève présent en {filtre === "all" ? getSectionLabel(depart) : filtre}.
        </p>
      ) : (
        <div style={{maxHeight:360,overflowY:"auto",border:"1px solid var(--lc-border)",borderRadius:8,marginBottom:12}}>
          <table style={{width:"100%",fontSize:12,borderCollapse:"collapse"}}>
            <thead><tr style={{background:"#f0f6ff",position:"sticky",top:0}}>
              <th style={{padding:"6px 8px",width:32}}>
                <input type="checkbox" checked={tousCoches} onChange={basculerTous} aria-label="Tout cocher"/>
              </th>
              <th style={{padding:"6px 8px",textAlign:"left"}}>Élève</th>
              <th style={{padding:"6px 8px",textAlign:"left"}}>Matricule</th>
              <th style={{padding:"6px 8px",textAlign:"left"}}>Classe actuelle</th>
            </tr></thead>
            <tbody>{visibles.map((e) => (
              <tr key={e._id} onClick={() => basculer(e._id)}
                style={{borderBottom:"1px solid #e5e7eb",cursor:"pointer",background:coches.has(e._id)?"#dcfce7":undefined}}>
                <td style={{padding:"4px 8px",textAlign:"center"}}>
                  <input type="checkbox" checked={coches.has(e._id)} onChange={() => basculer(e._id)} onClick={(ev) => ev.stopPropagation()}/>
                </td>
                <td style={{padding:"4px 8px",fontWeight:700}}>{e.nom} {e.prenom}</td>
                <td style={{padding:"4px 8px",color:"#6b7280"}}>{e.matricule || "—"}</td>
                <td style={{padding:"4px 8px"}}>{e.classe}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"flex-end"}}>
        <Btn v="ghost" onClick={() => setModal(null)} disabled={enCours}>Fermer</Btn>
        <Btn onClick={appliquer} disabled={enCours || !choisis.length || !classeArriveeValide(classe, arrivee)}>
          {enCours ? "⏳ En cours…" : `➡️ Faire passer ${choisis.length} élève(s) en ${classe || "…"}`}
        </Btn>
      </div>
    </Modale>
  );
}
