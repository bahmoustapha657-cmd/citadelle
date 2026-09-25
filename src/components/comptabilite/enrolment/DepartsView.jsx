import React from "react";
import { C, STATUTS_SORTIE, anneeScolaireDeDate, estSorti } from "../../../constants";
import { lireDate } from "../../../depart-utils";
import { imprimerCertificatRadiation, imprimerOrdreMutation } from "../../../reports";
import { situationAuDepart } from "../../transferts/situation-depart";
import { Badge, Btn, Card, Stat, THead, TR, TD, Vide } from "../../ui";

// Écran « Départs » de l'enrôlement. Seuls les statuts de sortie sont des
// départs ; « Inactif » (élève en sommeil, toujours inscrit) est compté à part
// et reste dans la liste des élèves. La date de départ est ce qui arrête les
// mensualités : une sortie sans date est signalée pour être complétée.
const couleurStatut = (statut) => (statut === "Exclu" ? "red" : statut === "Décédé" ? "gray"
  : statut === "Diplômé" ? "purple" : "amber");
const fondStatut = { Transféré: "#dbeafe", Exclu: "#fef9c3", Abandonné: "#ffe4e6", Décédé: "#f3f4f6", Diplômé: "#ede9fe" };

export function DepartsView({
  elevesEnrol, canEdit, modEnrol, toast, setForm, setModal, niveauEnrol,
  schoolInfo, moisAnnee = [], tarifsClasses = [], anneeOfficielle = "",
}) {
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

  return (<>
    {/* ── Stats cards ── */}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:18}}>
      <Stat label="Élèves présents" value={total - partis.length} bg="#dcfce7" sub={`${tauxRetention}% de rétention`}/>
      <Stat label="Total départs" value={partis.length} bg="#fee2e2"
        sub={anneeOfficielle ? `dont ${cetteAnnee} en ${anneeOfficielle}` : "toutes années confondues"}/>
      {parMotif.map((x) => <Stat key={x.motif} label={x.motif} value={x.count} bg={fondStatut[x.motif]}/>)}
      {inactifs.length > 0 && <Stat label="Inactifs" value={inactifs.length} bg="#f0fdf4" sub="toujours inscrits (en sommeil)"/>}
    </div>
    {sansDate > 0 && <div style={{background:"#fffbeb",border:"1px solid #fcd34d",borderRadius:8,padding:"9px 14px",marginBottom:14,fontSize:12,color:"#92400e"}}>
      ⚠️ {sansDate} départ(s) sans date : complétez-la via « Modifier ». C'est elle qui arrête les mensualités —
      sans elle, l'élève reste redevable de toute l'année.
    </div>}
    {parClasse.length > 0 && <Card style={{marginBottom:14}}>
      <div style={{padding:"12px 16px"}}>
        <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>Départs par classe</p>
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
    {partis.length === 0 ? <Vide icone="✅" msg="Aucun départ enregistré pour cette section"/>
    : <div className="lc-sticky-wrap">
      <table className="lc-sticky-table" data-fix-left="2" style={{minWidth:760}}>
        <THead cols={["Matricule","Nom & Prénom","Classe","Motif","Date départ","Destination / Détail","Documents",...(canEdit?["Actions"]:[])]}/>
        <tbody>{partis.map((e) => {
          const date = lireDate(e.dateDepart);
          return (
            <TR key={e._id}>
              <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
              <TD bold>{e.nom} {e.prenom}</TD>
              <TD><Badge color="blue">{e.classe}</Badge></TD>
              <TD><Badge color={couleurStatut(e.statut)}>{e.statut}</Badge></TD>
              <TD>{date ? date.toLocaleDateString("fr-FR") : <Badge color="amber">Date manquante</Badge>}</TD>
              <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.destinationDepart||e.motifDepart||"—"}</span></TD>
              <TD>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <Btn sm v="ghost" title="Certificat de radiation" onClick={() => {
                    const s = situation(e);
                    imprimerCertificatRadiation(e, schoolInfo, s.annee, s.solde, s);
                  }}>📄 Radiation</Btn>
                  {e.statut === "Transféré" && <Btn sm v="ghost" title="Ordre de mutation" onClick={() => {
                    const s = situation(e);
                    imprimerOrdreMutation(e, schoolInfo, e.destinationDepart || "", s.annee, s);
                  }}>📄 Mutation</Btn>}
                </div>
              </TD>
              {canEdit&&<TD>
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <Btn sm v="ghost" title="Corriger la date, le motif ou la destination" onClick={() => {
                    setForm({ ...e, niveau: niveauEnrol });
                    setModal("edit_enrol");
                  }}>Modifier</Btn>
                  <Btn sm v="vert" onClick={async () => {
                    if (confirm(`Réintégrer ${e.nom} ${e.prenom} comme élève Actif ?`)) {
                      await modEnrol({ _id: e._id, statut: "Actif", dateDepart: null, motifDepart: null, destinationDepart: null });
                      toast("Élève réintégré", "success");
                    }
                  }}>↩ Réintégrer</Btn>
                </div>
              </TD>}
            </TR>
          );
        })}</tbody>
      </table>
    </div>}
  </>);
}
