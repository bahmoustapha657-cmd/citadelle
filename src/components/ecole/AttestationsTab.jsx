import React from "react";
import { C } from "../../constants";
import { Badge, Btn, Card, Chargement, TD, THead, TR, Vide } from "../ui";
import { imprimerAttestation } from "../../reports";

export function AttestationsTab({
  rechercheMatricule,
  setRechercheMatricule,
  filtreClasse,
  setFiltreClasse,
  classesUniq,
  elevesFiltres,
  schoolInfo,
  annee,
  avecEns,
  cE,
}) {
  const elevesAtt = elevesFiltres.filter(e=>!rechercheMatricule
    ||(e.matricule||"").toLowerCase().includes(rechercheMatricule.toLowerCase())
    ||(e.nom+" "+e.prenom).toLowerCase().includes(rechercheMatricule.toLowerCase()));

  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16,flexWrap:"wrap"}}>
        <strong style={{fontSize:14,color:C.blueDark,flex:1}}>Attestations de niveau</strong>
        <input placeholder="🔍 Recherche nom / matricule..."
          value={rechercheMatricule||""} onChange={e=>setRechercheMatricule(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,width:200}}/>
        <select value={filtreClasse} onChange={e=>setFiltreClasse(e.target.value)}
          style={{border:"1px solid #b0c4d8",borderRadius:7,padding:"6px 10px",fontSize:12,background:"#fff"}}>
          <option value="all">Toutes les classes</option>
          {classesUniq.map(c=><option key={c}>{c}</option>)}
        </select>
        <Btn sm v="amber" onClick={()=>{
          if(!elevesAtt.length){alert("Aucun élève à imprimer.");return;}
          const w=window.open("","_blank");
          const rows=elevesAtt.map(e=>`<tr><td>${e.matricule||"—"}</td><td>${e.nom} ${e.prenom}</td><td>${e.classe}</td><td>${e.dateNaissance||"—"}</td><td>${e.lieuNaissance||"—"}</td></tr>`).join("");
          w.document.write(`<!DOCTYPE html><html><head><title>Attestations — ${filtreClasse==="all"?"Toutes classes":filtreClasse}</title><style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}button{display:none}}body{font-family:Arial,sans-serif;padding:14mm 12mm;margin:0}h2{color:#0A1628;text-align:center}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0A1628;color:#fff;padding:8px}td{padding:7px 8px;border-bottom:1px solid #e5e7eb}</style></head><body><h2>${schoolInfo.nom||"École"} — Registre des attestations</h2><p style="text-align:center">${filtreClasse==="all"?"Toutes classes":filtreClasse} · Année ${annee}</p><table><tr><th>Matricule</th><th>Nom & Prénom</th><th>Classe</th><th>Date naissance</th><th>Lieu naissance</th></tr>${rows}</table><br/><button onclick="window.print()">🖨️ Imprimer la liste</button></body></html>`);
          w.document.close();
        }}>📋 Liste en lot</Btn>
      </div>
      <div style={{background:"#eaf4e0",border:"1px solid #86efac",borderRadius:8,padding:"9px 14px",fontSize:12,color:"#166534",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16}}>📜</span>
        <span>Cliquez sur <strong>Imprimer</strong> pour générer l'attestation officielle de niveau pour chaque élève.</span>
      </div>
      {cE?<Chargement/>:elevesAtt.length===0?<Vide icone="📜" msg="Aucun élève pour cette sélection"/>
        :<Card><table style={{width:"100%",borderCollapse:"collapse"}}>
          <THead cols={["Matricule","Nom & Prénom","Classe","Niveau","Statut","Attestation"]}/>
          <tbody>{elevesAtt.map(e=><TR key={e._id}>
            <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule||"—"}</span></TD>
            <TD bold>{e.nom} {e.prenom}</TD>
            <TD><Badge color="blue">{e.classe}</Badge></TD>
            <TD><Badge color={avecEns?"purple":"amber"}>{avecEns?"Collège":"Primaire"}</Badge></TD>
            <TD><Badge color={e.statut==="Actif"?"vert":"gray"}>{e.statut||"Actif"}</Badge></TD>
            <TD><Btn sm v="amber" onClick={()=>imprimerAttestation(e,avecEns?"college":"primaire",annee,schoolInfo)}>🖨️ Imprimer</Btn></TD>
          </TR>)}</tbody>
        </table></Card>}
    </div>
  );
}
