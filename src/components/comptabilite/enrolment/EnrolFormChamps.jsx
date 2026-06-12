import { useContext } from "react";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { C, getClassesForSection, getSystemeScolaire } from "../../../constants";
import { Champ, Input, Selec } from "../../ui";

// Grille de champs du formulaire d'inscription d'un élève.
export function EnrolFormChamps({ form, chg, niveauEnrol }) {
  const { schoolInfo } = useContext(SchoolContext);
  return (
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
      <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
      <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
      <Champ label="Matricule (auto-généré)">
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <input value={form.matricule||""} onChange={chg("matricule")}
            style={{flex:1,border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
          <span style={{fontSize:10,color:"#9ca3af",whiteSpace:"nowrap"}}>Modifiable si besoin</span>
        </div>
      </Champ>
      <Champ label="Identifiant National (IEN)">
        <div style={{position:"relative"}}>
          <input value={form.ien||""} onChange={chg("ien")}
            placeholder="Ex : GN-2024-000123"
            style={{width:"100%",border:"1.5px solid #c7d2fe",borderRadius:8,padding:"7px 10px 7px 30px",fontSize:13,boxSizing:"border-box",outline:"none",background:"#eef2ff",fontFamily:"monospace",fontWeight:700,color:"#3730a3"}}/>
          <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",fontSize:13}}>🪪</span>
        </div>
      </Champ>
      <Champ label="Classe">
        <select value={form.classe||""} onChange={chg("classe")}
          style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
          <option value="">— Sélectionner —</option>
          {getClassesForSection(niveauEnrol, getSystemeScolaire(schoolInfo)).map(c=><option key={c}>{c}</option>)}
        </select>
      </Champ>
      <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
        <option value="M">Masculin</option><option value="F">Féminin</option>
      </Selec>
      <Selec label="Statut" value={form.statut||"Actif"} onChange={chg("statut")}>
        <option>Actif</option><option>Inactif</option><option>Transféré</option><option>Exclu</option><option>Abandonné</option><option>Décédé</option>
      </Selec>
      <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
        <option>Première inscription</option><option>Réinscription</option>
      </Selec>
      {["Transféré","Exclu","Abandonné","Décédé"].includes(form.statut)&&<>
        <Input label="Date de départ" type="date" value={form.dateDepart||""} onChange={chg("dateDepart")}/>
        <div style={{gridColumn:"1/-1"}}>
          <Input label="Motif du départ" value={form.motifDepart||""} onChange={chg("motifDepart")} placeholder="Ex: Transfert vers Lycée Donka, fin d'année..."/>
        </div>
        {form.statut==="Transféré"&&<div style={{gridColumn:"1/-1"}}>
          <Input label="École de destination" value={form.destinationDepart||""} onChange={chg("destinationDepart")} placeholder="Nom de l'école d'accueil"/>
        </div>}
      </>}
      <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")}/></div>
      <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")}/>
      <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")}/>
      <Input label="Domicile Tuteur" value={form.domicile||""} onChange={chg("domicile")}/>
      <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
      <Input label="Lieu de naissance" value={form.lieuNaissance||""} onChange={chg("lieuNaissance")}/>
      {form.typeInscription==="Réinscription"&&
        <Input label="Établissement d'origine (si transféré)" value={form.etablissementOrigine||""} onChange={chg("etablissementOrigine")} placeholder="Nom de l'ancienne école"/>
      }
    </div>
  );
}
