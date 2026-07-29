import { Btn, Modale, Input, Selec } from "../../ui";
import { C } from "../../../constants";
import { buildCreneauData } from "./cellule-data";
import { CelluleRevisionPrime } from "./CelluleRevisionPrime";
import { CelluleEnseignantSelect } from "./CelluleEnseignantSelect";

export function CelluleModale({
  edtCellule, setEdtCellule, canCreate, canEdit,
  form, setForm, chg,
  classeEdtActuelle, matieres, ens, emplois, isPrimarySection,
  ajEmp, modEmp, supEmp, toast,
}) {
  if (!edtCellule || !(canCreate || canEdit)) return null;

  const enregistrer = () => {
    // Une récréation / pause n'a ni matière au programme ni enseignant
    // affecté : son libellé est facultatif (« Récréation » par défaut). Les
    // deux contrôles ci-dessous ne valent donc que pour un cours ou une
    // révision.
    const estRecreation = (form.type || "cours") === "recreation";
    if(!estRecreation){
      if(!form.matiere){toast("Choisissez une matière.","warning");return;}
      if(!form.enseignant){toast("Choisissez un enseignant.","warning");return;}
    }
    const data=buildCreneauData(form, classeEdtActuelle, edtCellule);
    if(edtCellule.existing)modEmp({...data,_id:edtCellule.existing._id});
    else ajEmp(data);
    setEdtCellule(null);
  };

  return (
    <Modale titre={edtCellule.existing ? "Modifier le créneau" : "Nouveau créneau"} fermer={() => setEdtCellule(null)}>
      <div style={{marginBottom:12,padding:"8px 12px",background:"#f0f7ff",borderRadius:8,fontSize:12,color:C.blueDark,display:"flex",gap:16,flexWrap:"wrap"}}>
        <span>📅 <strong>{edtCellule.jour}</strong></span>
        <span>⏰ <strong>{edtCellule.heureDebut} → {edtCellule.heureFin}</strong></span>
        <span>🏫 <strong>{form.classe||classeEdtActuelle}</strong></span>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:14}}>
        {[
          {v:"cours",label:"📚 Cours",c:"#3b82f6",bg:"#eff6ff",txt:"#1d4ed8"},
          {v:"revision",label:"📝 Révision",c:"#f97316",bg:"#fff7ed",txt:"#9a3412"},
          {v:"recreation",label:"🍎 Récréation",c:"#10b981",bg:"#ecfdf5",txt:"#047857"},
        ].map(t=>{
          const actif=(form.type||"cours")===t.v;
          return (
            <button key={t.v} onClick={()=>setForm(p=>({
              ...p, type:t.v,
              // Une récréation (ou une pause) n'a ni matière ni enseignant :
              // on nettoie ces champs pour ne pas laisser de résidu d'un
              // cours saisi avant la bascule.
              ...(t.v==="recreation" ? { matiere:"", enseignant:"", salle:"" } : {}),
            }))}
              style={{flex:1,padding:"9px 0",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:12.5,
                background:actif?t.bg:"#f9fafb",
                border:`2px solid ${actif?t.c:"#e5e7eb"}`,
                color:actif?t.txt:"#6b7280"}}>
              {t.label}
            </button>
          );
        })}
      </div>

      {(form.type||"cours")!=="recreation" && <CelluleRevisionPrime form={form} setForm={setForm}/>}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {(form.type||"cours")==="recreation" ? (
          <>
            <Input label="Libellé" value={form.matiere||""} onChange={chg("matiere")}
              placeholder="Récréation, Pause déjeuner, Sieste…"/>
            <div/>
          </>
        ) : (
          <>
            <Selec label="Matière" value={form.matiere||""} onChange={e=>{setForm(p=>({...p,matiere:e.target.value,enseignant:""}));}}>
              <option value="">— Sélectionner —</option>
              {matieres.map(m=><option key={m._id}>{m.nom}</option>)}
            </Selec>
            <CelluleEnseignantSelect
              form={form} chg={chg} edtCellule={edtCellule} classeEdtActuelle={classeEdtActuelle}
              ens={ens} emplois={emplois} isPrimarySection={isPrimarySection}
            />
            <Input label="Salle (optionnel)" value={form.salle||""} onChange={chg("salle")}/>
          </>
        )}
        <div style={{display:"flex",alignItems:"flex-end",gap:8}}>
          <Input label="Début" type="time" value={form.heureDebut||edtCellule.heureDebut} onChange={chg("heureDebut")}/>
          <Input label="Fin" type="time" value={form.heureFin||edtCellule.heureFin} onChange={chg("heureFin")}/>
        </div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:16}}>
        <div>
          {edtCellule.existing&&canEdit&&<Btn v="danger" onClick={()=>{supEmp(edtCellule.existing._id);setEdtCellule(null);}}>🗑 Supprimer</Btn>}
        </div>
        <div style={{display:"flex",gap:8}}>
          <Btn v="ghost" onClick={()=>setEdtCellule(null)}>Annuler</Btn>
          <Btn onClick={enregistrer}>✅ Enregistrer</Btn>
        </div>
      </div>
    </Modale>
  );
}
