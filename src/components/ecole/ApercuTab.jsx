import { useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { Btn, Card, Chargement, Stat, Vide } from "../ui";
import { imprimerListeClasse } from "../../reports";
import { ApercuGraphiques } from "./apercu-tab/ApercuGraphiques";
import { ApercuHonneur } from "./apercu-tab/ApercuHonneur";
import { ApercuAnalytics } from "./apercu-tab/ApercuAnalytics";
import { QrScannerModal } from "../verif-qr/QrScannerModal";

export function ApercuTab({
  classes, eleves, ens, notes, absences, avecEns, moy, maxNote,
  cC, cE, classesUniq, effectifReel, matieresForClasse, couleur, schoolInfo, periodes,
}) {
  const { t } = useTranslation();
  const [scanQr, setScanQr] = useState(false);
  return (
    <div>
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
        <Btn sm v="ghost" onClick={()=>setScanQr(true)}>🔍 Vérifier un QR</Btn>
      </div>
      {scanQr && <QrScannerModal schoolInfo={schoolInfo} fermer={()=>setScanQr(false)} />}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10,marginBottom:16}}>
        <Stat label={t("school.classes.title")} value={classes.length}/>
        <Stat label={t("school.students.active")} value={eleves.filter(e=>e.statut==="Actif").length} sub={`/ ${eleves.length}`}/>
        {avecEns&&<Stat label={t("school.teachers.title")} value={ens.length}/>}
        <Stat label={t("school.bulletins.average")} value={`${moy}/${maxNote}`} bg="#eaf4e0"/>
        <Stat label={t("dashboard.absences")} value={absences.length} bg="#fef3e0"/>
      </div>
      {(cC||cE)?<Chargement/>:classes.length===0&&eleves.length===0?<Vide icone={avecEns?"🏫":"🎒"} msg="Module vide"/>
        :<Card><div style={{padding:"16px 18px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <p style={{margin:0,fontWeight:800,fontSize:14,color:C.blueDark}}>{t("school.overview.studentsByClass")}</p>
            <div style={{display:"flex",gap:8}}>
              {classesUniq.map(cl=>(
                <Btn sm key={cl} v="ghost" onClick={()=>imprimerListeClasse(cl,eleves,schoolInfo)}>🖨️ {cl}</Btn>
              ))}
            </div>
          </div>
          {classes.map(c=>(
            <div key={c._id} style={{display:"flex",alignItems:"center",gap:9,marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:700,color:C.blueDark,width:76}}>{c.nom}</span>
              <div style={{flex:1,background:"#e0ebf8",borderRadius:5,height:8}}>
                <div style={{background:couleur,borderRadius:5,height:8,width:`${Math.min(effectifReel(c.nom)/50*100,100).toFixed(0)}%`}}/>
              </div>
              <span style={{fontSize:11,color:"#6b7280",width:26,textAlign:"right",fontWeight:600}}>{effectifReel(c.nom)}</span>
            </div>
          ))}
        </div></Card>}

      <ApercuGraphiques
        classes={classes} eleves={eleves} notes={notes} effectifReel={effectifReel}
        matieresForClasse={matieresForClasse} couleur={couleur} maxNote={maxNote}
      />

      <ApercuAnalytics
        classes={classes} eleves={eleves} notes={notes}
        matieresForClasse={matieresForClasse} periodes={periodes} maxNote={maxNote} couleur={couleur}
      />

      <ApercuHonneur eleves={eleves} notes={notes} matieresForClasse={matieresForClasse}/>
    </div>
  );
}
