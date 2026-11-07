import React, { useContext, useState } from "react";
import { useTranslation } from "react-i18next";
import { localeCourante } from "../../../i18n";
import { libelleStatutEleve } from "../../../i18n/libelles";
import { C, STATUTS_SORTIE, anneeScolaireDeDate, estSorti } from "../../../constants";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { aujourdhuiIso, champsRetour, lireDate } from "../../../depart-utils";
import { imprimerCertificatRadiation, imprimerOrdreMutation } from "../../../reports";
import { situationAuDepart } from "../../transferts/situation-depart";
import { Badge, Btn, Card, Modale, Stat, THead, TR, TD, Vide } from "../../ui";
import { RetourChoix } from "./RetourChoix";

// Écran « Départs » de l'enrôlement. Seuls les statuts de sortie sont des
// départs ; « Inactif » (élève en sommeil, toujours inscrit) est compté à part
// et reste dans la liste des élèves. La date de départ est ce qui arrête les
// mensualités : une sortie sans date est signalée pour être complétée.
// Statuts enregistrés (en français) : comparés, jamais affichés tels quels.
const couleurStatut = (statut) => (statut === "Exclu" ? "red" : statut === "Décédé" ? "gray" // i18n-ignore
  : statut === "Diplômé" ? "purple" : "amber"); // i18n-ignore
// i18n-ignore
const fondStatut = { Transféré: "#dbeafe", Exclu: "#fef9c3", Abandonné: "#ffe4e6", Décédé: "#f3f4f6", Diplômé: "#ede9fe" };

export function DepartsView({
  elevesEnrol, canEdit, modChamp, toast, setForm, setModal, niveauEnrol,
  schoolInfo, moisAnnee = [], tarifsClasses = [], anneeOfficielle = "",
}) {
  const { t } = useTranslation();
  const partis = elevesEnrol.filter(estSorti)
    // Les plus récents d'abord ; les sorties sans date à la fin.
    .sort((a, b) => String(b.dateDepart || "").localeCompare(String(a.dateDepart || "")));
  const inactifs = elevesEnrol.filter((e) => e.statut === "Inactif");
  const total = elevesEnrol.length;
  const tauxRetention = total > 0 ? (((total - partis.length) / total) * 100).toFixed(1) : "100";
  const cetteAnnee = partis.filter((e) => anneeScolaireDeDate(e.dateDepart) === anneeOfficielle).length;
  const sansDate = partis.filter((e) => !lireDate(e.dateDepart)).length;
  const parMotif = STATUTS_SORTIE.map((m) => ({ motif: m, count: partis.filter((e) => e.statut === m).length }))
    .filter((x) => x.count > 0);
  const parClasse = [...new Set(partis.map((e) => e.classe))].filter(Boolean).map((cl) => ({
    classe: cl, count: partis.filter((e) => e.classe === cl).length,
  })).sort((a, b) => b.count - a.count);
  const situation = (e) => situationAuDepart(e, { moisAnnee, tarifsClasses, anneeOfficielle });

  // Retour d'un élève parti : date de retour + mois d'absence dus ou non.
  const { logAction } = useContext(SchoolContext);
  const [retour, setRetour] = useState(null);
  const [dateRetour, setDateRetour] = useState("");
  const [absenceDue, setAbsenceDue] = useState(null);
  const [enCours, setEnCours] = useState(false);
  const reintegrer = async () => {
    const { champs, erreur } = champsRetour(retour, { dateRetour, absenceDue });
    if (erreur) { toast(erreur, "warning"); return; }
    setEnCours(true);
    try {
      // Mise à jour PARTIELLE : statut, départ et interruptions seulement.
      // `modifier` (fiche complète) réécrivait tout le jsonb `extra` à partir
      // de ces quatre champs — mensualités, inscription et historique perdus.
      await modChamp(retour._id, champs);
      // Journal des actions (donnée partagée) : en français.
      logAction?.("Réintégration d'un élève", // i18n-ignore
        `${retour.nom} ${retour.prenom} (${retour.classe}) — parti le ${retour.dateDepart || "?"}, revenu le ${dateRetour || "?"} ; ` // i18n-ignore
        + (absenceDue ? "mois d'absence dus" : "mois d'absence non dus")); // i18n-ignore
      toast(t("accounting.departs.reinstated"), "success");
      setRetour(null);
    } catch (err) {
      toast(t("accounting.departs.reinstateFailed", { error: err.message }), "error");
    } finally {
      setEnCours(false);
    }
  };

  return (<>
    {/* ── Stats cards ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
      <Stat label={t("accounting.departs.present")} value={total - partis.length} bg="#dcfce7" sub={t("accounting.departs.retention", { rate: tauxRetention })}/>
      <Stat label={t("accounting.departs.total")} value={partis.length} bg="#fee2e2"
        sub={anneeOfficielle ? t("accounting.departs.thisYear", { count: cetteAnnee, year: anneeOfficielle }) : t("accounting.departs.allYears")}/>
      {parMotif.map((x) => <Stat key={x.motif} label={libelleStatutEleve(x.motif)} value={x.count} bg={fondStatut[x.motif]}/>)}
      {inactifs.length > 0 && <Stat label={t("accounting.departs.inactive")} value={inactifs.length} bg="#f0fdf4" sub={t("accounting.departs.inactiveSub")}/>}
    </div>
    {sansDate > 0 && <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:"#92400e"}}>
      ⚠️ {t("accounting.departs.noDate", { count: sansDate, edit: t("common.edit") })}
    </div>}
    {parClasse.length > 0 && <Card style={{marginBottom:14}}>
      <div style={{padding:"12px 16px"}}>
        <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>{t("accounting.departs.byClass")}</p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {parClasse.map((x) => (
            <span key={x.classe} style={{background:"#fee2e2",color:"#b91c1c",fontWeight:800,fontSize:12,padding:"4px 12px",borderRadius:20}}>
              {x.classe} : {x.count}
            </span>
          ))}
        </div>
      </div>
    </Card>}
    {/* ── Liste des partis ── */}
    {partis.length === 0 ? <Vide icone="✅" msg={t("accounting.departs.none")}/>
    : <div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:760}}>
        <THead cols={[t("accounting.cols.matricule"), t("accounting.cols.name"), t("accounting.cols.class"), t("accounting.departs.colReason"),
          t("accounting.departs.colDate"), t("accounting.departs.colDestination"), t("accounting.departs.colDocuments"), ...(canEdit?[t("accounting.cols.actions")]:[])]}/>
        <tbody>{partis.map((e) => {
          const date = lireDate(e.dateDepart);
          return (
            <TR key={e._id}>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
              <TD bold>{e.nom} {e.prenom}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD><Badge color={couleurStatut(e.statut)}>{libelleStatutEleve(e.statut)}</Badge></TD>
              <TD>{date ? date.toLocaleDateString(localeCourante()) : <Badge color="amber">{t("accounting.departs.missingDate")}</Badge>}</TD>
              <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.destinationDepart||e.motifDepart||"—"}</span></TD>
              <TD>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <Btn sm v="ghost" title={t("accounting.departs.radiationHint")} onClick={() => {
                    const s = situation(e);
                    imprimerCertificatRadiation(e, schoolInfo, s.annee, s.solde, s);
                  }}>📄 {t("accounting.departs.radiation")}</Btn>
                  {/* i18n-ignore */}
                  {e.statut === "Transféré" && <Btn sm v="ghost" title={t("accounting.departs.mutationHint")} onClick={() => {
                    const s = situation(e);
                    imprimerOrdreMutation(e, schoolInfo, e.destinationDepart || "", s.annee, s);
                  }}>📄 {t("accounting.departs.mutation")}</Btn>}
                </div>
              </TD>
              {canEdit&&<TD>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <Btn sm v="ghost" title={t("accounting.departs.editHint")} onClick={() => {
                    setForm({ ...e, niveau: niveauEnrol });
                    setModal("edit_enrol");
                  }}>{t("common.edit")}</Btn>
                  <Btn sm v="vert" onClick={() => {
                    setRetour(e); setDateRetour(aujourdhuiIso()); setAbsenceDue(null);
                  }}>↩ {t("accounting.departs.reinstate")}</Btn>
                </div>
              </TD>}
            </TR>
          );
        })}</tbody>
      </table>
    </div>}

    {retour && <Modale titre={`↩ ${t("accounting.departs.reinstateName", { name: `${retour.nom} ${retour.prenom}` })}`} fermer={() => !enCours && setRetour(null)}>
      <RetourChoix dateDepart={retour.dateDepart} dateRetour={dateRetour} setDateRetour={setDateRetour}
        absenceDue={absenceDue} setAbsenceDue={setAbsenceDue}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={() => setRetour(null)} disabled={enCours}>{t("common.cancel")}</Btn>
        <Btn v="vert" onClick={reintegrer} disabled={enCours || absenceDue === null}>
          {enCours ? `⏳ ${t("accounting.collect.saving")}` : `↩ ${t("accounting.departs.reinstateActive")}`}
        </Btn>
      </div>
    </Modale>}
  </>);
}
