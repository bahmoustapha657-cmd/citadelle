import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { C } from "../../../constants";
import { Card } from "../../ui";
import { getGeneralAverage } from "../../../note-utils";

// Deux histogrammes côte à côte : effectifs par classe et moyenne générale
// par classe.
export function ApercuGraphiques({ classes, eleves, notes, effectifReel, matieresForClasse, couleur, maxNote }) {
  if (classes.length === 0) return null;
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
      <Card><div style={{padding:"14px 16px"}}>
        <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Effectifs par classe</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={classes.map(c=>({classe:c.nom,Effectif:effectifReel(c.nom)}))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
            <XAxis dataKey="classe" tick={{fontSize:10}}/>
            <YAxis tick={{fontSize:10}}/>
            <Tooltip/>
            <Bar dataKey="Effectif" fill={couleur} radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div></Card>

      <Card><div style={{padding:"14px 16px"}}>
        <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:C.blueDark}}>Moyenne générale par classe</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={classes.map(c=>{
            const elevesClasse=eleves.filter(e=>e.classe===c.nom);
            if(!elevesClasse.length) return {classe:c.nom,Moyenne:0};
            const moyClasse=elevesClasse.map(e=>{
              const notesE=notes.filter(n=>n.eleveId===e._id);
              return getGeneralAverage(notesE, matieresForClasse(e.classe), e.classe);
            }).filter(m=>m!==null);
            const moyV=moyClasse.length?(moyClasse.reduce((s,m)=>s+m,0)/moyClasse.length).toFixed(2):0;
            return {classe:c.nom,Moyenne:Number(moyV)};
          })}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
            <XAxis dataKey="classe" tick={{fontSize:10}}/>
            <YAxis domain={[0,maxNote]} tick={{fontSize:10}}/>
            <Tooltip formatter={v=>`${v}/${maxNote}`}/>
            <Bar dataKey="Moyenne" fill="#f59e0b" radius={[4,4,0,0]}/>
          </BarChart>
        </ResponsiveContainer>
      </div></Card>
    </div>
  );
}
