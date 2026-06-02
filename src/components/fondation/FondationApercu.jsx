import { Chargement, Stat, Vide } from "../ui";

// Onglet Aperçu de la Fondation : statistiques de gouvernance.
export function FondationApercu({ membres, docs, schoolInfo, cM }) {
  return (
    <div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10,marginBottom:18}}>
        <Stat label="Membres CA" value={membres.length}/>
        <Stat label="Documents" value={docs.length}/>
        <Stat label="Établissement" value={schoolInfo?.nom||"—"} bg="#e0ebf8"/>
        <Stat label="Agrément" value={schoolInfo?.agrement||"—"} bg="#eaf4e0"/>
      </div>
      {membres.length===0&&!cM&&<Vide icone="🏛️" msg="Module vide"/>}
      {cM&&<Chargement/>}
    </div>
  );
}
