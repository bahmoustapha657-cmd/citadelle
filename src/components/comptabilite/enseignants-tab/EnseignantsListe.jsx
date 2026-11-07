import { useContext } from "react";
import { Trans, useTranslation } from "react-i18next";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { C, fmtN } from "../../../constants";
import { Badge, Btn, Card, TD, THead, TR, Vide } from "../../ui";
import { estSectionForfait, sectionEnsParDefaut, sectionsEnsOuvertes } from "./use-enseignants-tab";
import { libelleSectionEnseignant, libelleStatutEnseignant } from "../../../i18n/libelles";

// Couleur du badge de section (clés connues de <Badge>).
const COULEUR_SECTION = { "Préscolaire": "amber", Primaire: "blue", "Collège": "purple", "Lycée": "teal" };

// En-tête + bandeau d'aide + statistiques par section + tableau des
// enseignants (identité et paie).
export function EnseignantsListe({ ensTous, ensPrimaire, ensCollege, ensLycee, ensPrescolaire = [], canCreate, canEdit, setForm, setModal, supEnsForSection }) {
  const { t } = useTranslation();
  const { schoolInfo } = useContext(SchoolContext);
  // Une carte par section ouverte dans l'école : pas de « Lycée : 0 » dans
  // une école sans lycée.
  const sectionsOuvertes = sectionsEnsOuvertes(schoolInfo);
  return (
    <>
      <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>{t("accounting.tabs.teachers")} ({ensTous.length})</strong>
        {canCreate&&<Btn onClick={()=>{setForm({_section:sectionEnsParDefaut(schoolInfo),statut:"Titulaire"});setModal("add_ens_compta");}}>+ {t("common.add")}</Btn>}
      </div>

      <div style={{padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af",marginBottom:14}}>
        <Trans i18nKey="accounting.ens.hybridView" components={{ b: <strong />, i: <em /> }} />
      </div>

      {/* Stats par section */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:10,marginBottom:16}}>
        {[
          // Valeurs de `_section` (données), affichées par libelleSectionEnseignant.
          {sec:"Préscolaire",n:ensPrescolaire.length,col:"#d97706",bg:"#fef3c7"}, // i18n-ignore
          {sec:"Primaire",n:ensPrimaire.length,col:"#0ea5e9",bg:"#e0f2fe"},
          {sec:"Collège",n:ensCollege.length,col:"#7c3aed",bg:"#f3e8ff"}, // i18n-ignore
          {sec:"Lycée",n:ensLycee.length,col:"#db2777",bg:"#fce7f3"}, // i18n-ignore
        ].filter(s=>sectionsOuvertes.includes(s.sec)).map(s=>(
          <div key={s.sec} style={{background:s.bg,borderRadius:10,padding:"12px 14px",textAlign:"center",border:`1px solid ${s.col}33`}}>
            <div style={{fontSize:11,color:s.col,fontWeight:700,marginBottom:4}}>{libelleSectionEnseignant(s.sec)}</div>
            <div style={{fontSize:20,fontWeight:900,color:C.blueDark}}>{s.n}</div>
          </div>
        ))}
      </div>

      {ensTous.length===0?<Vide icone="🎓" msg={t("accounting.ens.none")}/>
        :<Card><div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
          <THead cols={[t("accounting.sal.cols.fullName"),t("accounting.section"),t("accounting.sal.cols.subject"),t("accounting.ens.homeClass"),t("common.status"),t("accounting.ens.pay"),canEdit?t("common.actions"):""]}/>
          <tbody>{ensTous.map(e=>{
            const isPrim=estSectionForfait(e._section);
            const paie=isPrim?"—":t("accounting.ens.perHour",{amount:fmtN(e.primeHoraire||0)});
            const couleurSec=COULEUR_SECTION[e._section]||"gray";
            return <TR key={`${e._section}-${e._id}`}>
              <TD bold>{e.prenom||""} {e.nom||""}</TD>
              <TD><Badge color={couleurSec}>{libelleSectionEnseignant(e._section)}</Badge></TD>
              <TD>{e.matiere||"—"}</TD>
              <TD>{e.classeTitle||"—"}</TD>
              {/* i18n-ignore */}
              <TD><Badge color={(e.statut||"Titulaire")==="Titulaire"?"vert":"gray"}>{libelleStatutEnseignant(e.statut||"Titulaire")}</Badge></TD>
              <TD center>{paie}</TD>
              {canEdit&&<TD center>
                <Btn sm v="ghost" onClick={()=>{setForm({...e});setModal("edit_ens_compta");}}>✏️ {t("accounting.ens.pay")}</Btn>
                <Btn sm v="red" onClick={()=>confirm(t("accounting.ens.deleteConfirm",{name:`${e.prenom||""} ${e.nom||""}`.trim()}))&&supEnsForSection(e._section)(e._id)}>🗑</Btn>
              </TD>}
            </TR>;
          })}</tbody>
        </table></div></Card>
      }
    </>
  );
}
