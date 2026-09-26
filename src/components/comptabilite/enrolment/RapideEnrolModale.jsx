import { useState } from "react";
import { C, initMens, getClassesForSection, getSectionLabel, getSystemeScolaire, sectionOuverte } from "../../../constants";
import { Btn, Champ, Input, Modale, Selec } from "../../ui";
import { findEnrollmentDuplicate, getEnrollmentDuplicateMessage } from "../../../enrollment-utils";
import { uploadPhotoEleve } from "../../../storageUtils";
import { PhotoEleveChamp } from "./PhotoEleveChamp";
import { CompteParentFratrie } from "./CompteParentFratrie";
import { useCompteParentFratrie } from "./use-compte-parent-fratrie";
import {
  changerSectionFormulaire, eleveVide, formulaireEleveSuivant, matriculeSaisieRapide, sectionsSaisieRapide,
} from "./rapide-enrol";

export function RapideEnrolModale({
  setModal, form, setForm, chg, niveauEnrol, peutCreerParent = false,
  schoolId, schoolInfo, toast, tousElevesScolarite, ajoutParNiveau, ensureClasse, elevesParNiveau,
}) {
  // Élèves enregistrés depuis l'ouverture : matricules suivants, contrôle des
  // doublons et récapitulatif, avant même que les listes soient rechargées.
  const [ajoutes, setAjoutes] = useState([]);
  const [enCours, setEnCours] = useState(false);
  // « saisie » des élèves, puis « parent » : le compte parent de la fratrie,
  // proposé en terminant (facultatif).
  const [etape, setEtape] = useState("saisie");
  const fratrie = useCompteParentFratrie({ eleves: ajoutes, schoolId, toast });
  const sections = sectionsSaisieRapide(schoolInfo);
  // Section de l'élève en cours : la sienne, pas celle de la barre d'outils.
  const section = sectionOuverte(schoolInfo, form.niveau || niveauEnrol);
  const matriculeDe = (s, dejaAjoutes = ajoutes) =>
    matriculeSaisieRapide(s, { elevesParNiveau, ajoutes: dejaAjoutes, schoolInfo });

  const changerSection = (e) => {
    const s = e.target.value;
    setForm((p) => changerSectionFormulaire(p, s, matriculeDe(s)));
  };

  // Enregistre l'élève en cours ; renvoie la liste des ajoutés, ou null.
  const sauvegarderRapide = async () => {
    if(!form.nom||!form.prenom){toast("Nom et prénom obligatoires","warning");return null;}
    if(!form.classe){toast("Classe obligatoire","warning");return null;}
    const ajouter = ajoutParNiveau[section];
    const r={...form,niveau:section,statut:"Actif",mens:initMens()};
    const doublon = findEnrollmentDuplicate(r, [...tousElevesScolarite, ...ajoutes]);
    if(doublon){
      toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
      return null;
    }
    setEnCours(true);
    try {
      if(String(r.photo||"").startsWith("data:")) r.photo = await uploadPhotoEleve(r.photo, schoolId);
      // Identifiant de la fiche créée : le compte parent de la fratrie s'y
      // rattache. Jamais `_id: null` — findEnrollmentDuplicate écarterait
      // l'élève du contrôle des doublons.
      const cree = await ajouter(r);
      if (cree?.id) r._id = cree.id;
      await ensureClasse(r.classe, section);
    } catch (e) {
      toast("Élève non enregistré : " + (e?.message || e), "error");
      return null;
    } finally {
      setEnCours(false);
    }
    toast(`${r.prenom} ${r.nom} ajouté(e) — ${r.classe} (${getSectionLabel(section)})`,"success");
    const nouveaux = [...ajoutes, r];
    setAjoutes(nouveaux);
    return nouveaux;
  };

  const eleveSuivant = async () => {
    const nouveaux = await sauvegarderRapide();
    if (!nouveaux) return;
    const mat = matriculeDe(section, nouveaux);
    setForm((p) => formulaireEleveSuivant(p, section, mat));
  };

  const terminer = async () => {
    // Après « Élève suivant », la fiche en cours est vide : rien à enregistrer.
    const inscrits = ajoutes.length && eleveVide(form) ? ajoutes : await sauvegarderRapide();
    if (!inscrits) return;
    // Avant de fermer, le compte parent de la fratrie — le tuteur est là.
    if (peutCreerParent && inscrits.some((e) => e._id)) { setEtape("parent"); return; }
    setModal(null);
  };

  if (etape === "parent") return (<Modale titre="⚡ Saisie rapide — Fratrie / même tuteur" fermer={()=>setModal(null)}>
    <RecapInscrits ajoutes={ajoutes}/>
    <CompteParentFratrie fratrie={fratrie}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={fratrie.enCours}>{fratrie.resultat?"Fermer":"Plus tard"}</Btn>
    </div>
  </Modale>);

  return (<Modale titre="⚡ Saisie rapide — Fratrie / même tuteur" fermer={()=>setModal(null)}>
    <div style={{background:"#f0f6ff",border:`1.5px solid ${C.blue}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        👨‍👩‍👧‍👦 Informations communes (conservées pour chaque élève)
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Nom du Tuteur" value={form.tuteur||""} onChange={chg("tuteur")} placeholder="Bah Mamadou"/>
        <Input label="Contact Tuteur" value={form.contactTuteur||""} onChange={chg("contactTuteur")} placeholder="622 000 000"/>
        <div style={{gridColumn:"1/-1"}}><Input label="Filiation (Père / Mère)" value={form.filiation||""} onChange={chg("filiation")} placeholder="Père: … / Mère: …"/></div>
        <div style={{gridColumn:"1/-1"}}><Input label="Domicile" value={form.domicile||""} onChange={chg("domicile")} placeholder="Quartier, commune…"/></div>
        {/* Une fratrie arrive le même jour : la date est conservée d'un élève
            au suivant, comme le tuteur et le domicile. */}
        <Input label="Date d'arrivée" type="date" value={form.dateArrivee||""} onChange={chg("dateArrivee")}/>
      </div>
    </div>
    <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px"}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>
        🎓 Élève à inscrire
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Input label="Nom *" value={form.nom||""} onChange={chg("nom")} placeholder="Bah"/>
        <Input label="Prénom *" value={form.prenom||""} onChange={chg("prenom")} placeholder="Aminata"/>
        {/* Une fratrie s'étale souvent sur plusieurs cycles : chaque élève
            est inscrit dans SA section (classes, matricule, liste). */}
        {sections.length>1&&<Selec label="Section *" value={section} onChange={changerSection}>
          {sections.map(s=><option key={s} value={s}>{getSectionLabel(s)}</option>)}
        </Selec>}
        <Champ label="Classe *">
          <select value={form.classe||""} onChange={chg("classe")}
            style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
            <option value="">— Sélectionner —</option>
            {getClassesForSection(section, getSystemeScolaire(schoolInfo)).map(c=><option key={c}>{c}</option>)}
          </select>
        </Champ>
        <Selec label="Sexe" value={form.sexe||"M"} onChange={chg("sexe")}>
          <option value="M">Masculin</option><option value="F">Féminin</option>
        </Selec>
        <Input label="Date de naissance" type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
        <Selec label="Type d'inscription" value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
          <option>Première inscription</option><option>Réinscription</option>
        </Selec>
        <Champ label="Matricule (auto)">
          <input value={form.matricule||""} onChange={chg("matricule")}
            style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"monospace",fontWeight:700,color:C.blue,background:"#e0ebf8"}}/>
        </Champ>
        <div style={{gridColumn:"1/-1",borderTop:"1px solid #e5e7eb",paddingTop:10}}>
          <PhotoEleveChamp photo={form.photo} onChange={photo=>setForm(p=>({...p,photo}))} toast={toast}/>
        </div>
      </div>
    </div>
    <RecapInscrits ajoutes={ajoutes}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14,flexWrap:"wrap"}}>
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={enCours}>{ajoutes.length?"Fermer":"Annuler"}</Btn>
      <Btn v="ghost" onClick={eleveSuivant} disabled={enCours}>➕ Élève suivant</Btn>
      <Btn onClick={terminer} disabled={enCours}>{enCours?"⏳ Enregistrement…":"✅ Terminer"}</Btn>
    </div>
  </Modale>);
}

function RecapInscrits({ ajoutes }) {
  if (!ajoutes.length) return null;
  return (
    <div style={{marginTop:12,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#166534",textAlign:"left"}}>
      <strong>✅ Déjà inscrits dans cette saisie ({ajoutes.length})</strong>
      <ul style={{margin:"6px 0 0",paddingLeft:18}}>
        {ajoutes.map((e,i)=><li key={`${e.matricule}-${i}`}>{e.prenom} {e.nom} — {e.classe} ({getSectionLabel(e.niveau)}) · <span style={{fontFamily:"monospace"}}>{e.matricule}</span></li>)}
      </ul>
    </div>
  );
}
