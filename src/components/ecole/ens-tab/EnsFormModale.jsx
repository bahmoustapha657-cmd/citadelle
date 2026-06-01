import { Btn, Input, Modale, Selec, UploadFichiers } from "../../ui";

// Modale d'ajout/édition d'un enseignant : identité, matière, grade, statut,
// classe de titulaire et pièces jointes. La paie est gérée en Comptabilité.
export function EnsFormModale({ modal, setModal, canCreate, canEdit, form, setForm, chg, cleEns, saveEnseignant }) {
  if (!((modal === "add_ens" && canCreate) || (modal === "edit_ens" && canEdit))) return null;
  return (
    <Modale titre={modal==="add_ens"?"Nouvel enseignant":"Modifier"} fermer={()=>setModal(null)}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <Input label="Nom" value={form.nom||""} onChange={chg("nom")}/>
        <Input label="Prénom" value={form.prenom||""} onChange={chg("prenom")}/>
        <Input label="Matière" value={form.matiere||""} onChange={chg("matiere")}/>
        <Input label="Grade" value={form.grade||""} onChange={chg("grade")}/>
        <Input label="Téléphone" value={form.telephone||""} onChange={chg("telephone")}/>
        <Selec label="Statut" value={form.statut||"Titulaire"} onChange={chg("statut")}>
          <option>Titulaire</option><option>Contractuel</option><option>Vacataire</option>
        </Selec>
        <div style={{gridColumn:"1/-1"}}>
          <Input label="Classe (titulaire)" value={form.classeTitle||""} onChange={chg("classeTitle")} placeholder="Ex : 3ème Année A — laissez vide si non titulaire"/>
        </div>
      </div>
      <div style={{marginTop:14,padding:"10px 14px",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:8,fontSize:12,color:"#1e40af"}}>
        <strong>Paie gérée par la Comptabilité.</strong> Les forfaits, primes horaires et primes par classe se renseignent dans <em>Comptabilité &gt; Enseignants</em>.
      </div>
      <UploadFichiers dossier={`enseignants/${cleEns}`} fichiers={form.fichiers||[]}
        onAjouter={f=>setForm(p=>({...p,fichiers:[...(p.fichiers||[]),f]}))}
        onSupprimer={i=>setForm(p=>({...p,fichiers:p.fichiers.filter((_,j)=>j!==i)}))}/>
      <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}>
        <Btn v="ghost" onClick={()=>setModal(null)}>Annuler</Btn>
        <Btn onClick={saveEnseignant}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
