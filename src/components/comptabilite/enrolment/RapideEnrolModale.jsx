import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { C, initMens, getClassesForSection, getSystemeScolaire, sectionOuverte } from "../../../constants";
import { libelleSection } from "../../../i18n/libelles";
import { Btn, Champ, Input, Modale, Selec } from "../../ui";
import {
  MESSAGE_CLASSE_OBLIGATOIRE, MESSAGE_FILIATION_OBLIGATOIRE, classeManquante, filiationManquante,
  findEnrollmentDuplicate, getEnrollmentDuplicateMessage,
} from "../../../enrollment-utils";
import { uploadPhotoEleve } from "../../../storageUtils";
import { SURNOM_MAX } from "../../../identite-enfant";
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
  const { t } = useTranslation();
  const [ajoutes, setAjoutes] = useState([]);
  const [enCours, setEnCours] = useState(false);
  // Lus par un clic qui suit avant le rendu : ni `enCours` ni `ajoutes` ne
  // sont encore à jour dans sa fermeture.
  const verrou = useRef(false);
  const ajoutesRef = useRef([]);
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
    // Double clic : le second appel partirait avant que `enCours` ne désactive
    // le bouton, et inscrirait l'élève deux fois.
    if(verrou.current) return null;
    if(!form.nom||!form.prenom){toast(t("accounting.quick.nameRequired"),"warning");return null;}
    if(classeManquante(form)){toast(MESSAGE_CLASSE_OBLIGATOIRE,"warning");return null;}
    if(filiationManquante(form)){toast(MESSAGE_FILIATION_OBLIGATOIRE,"warning");return null;}
    const ajouter = ajoutParNiveau[section];
    const r={...form,niveau:section,statut:"Actif",mens:initMens()};
    const doublon = findEnrollmentDuplicate(r, [...tousElevesScolarite, ...ajoutesRef.current]);
    if(doublon){
      toast(getEnrollmentDuplicateMessage(doublon, r),"warning");
      return null;
    }
    verrou.current = true;
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
      toast(t("accounting.quick.notSaved", { error: e?.message || e }), "error");
      return null;
    } finally {
      setEnCours(false);
      verrou.current = false;
    }
    toast(t("accounting.quick.added", { first: r.prenom, last: r.nom, class: r.classe, section: libelleSection(section) }),"success");
    const nouveaux = [...ajoutesRef.current, r];
    ajoutesRef.current = nouveaux;
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

  if (etape === "parent") return (<Modale titre={`⚡ ${t("accounting.quick.title")}`} fermer={()=>setModal(null)}>
    <RecapInscrits ajoutes={ajoutes}/>
    <CompteParentFratrie fratrie={fratrie}/>
    <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={fratrie.enCours}>{fratrie.resultat?t("common.close"):t("accounting.quick.later")}</Btn>
    </div>
  </Modale>);

  return (<Modale titre={`⚡ ${t("accounting.quick.title")}`} fermer={()=>setModal(null)}>
    <div style={{background:"#f0f6ff",border:`1.5px solid ${C.blue}`,borderRadius:10,padding:"12px 14px",marginBottom:14}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:C.blueDark,textTransform:"uppercase",letterSpacing:"0.06em"}}>
        👨‍👩‍👧‍👦 {t("accounting.quick.commonInfo")}
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {/* Exemples de noms guinéens : les mêmes dans toutes les langues. i18n-ignore */}
        <Input label={t("enrolment.guardianName")} value={form.tuteur||""} onChange={chg("tuteur")} placeholder="Bah Mamadou"/>
        <Input label={t("enrolment.guardianContact")} value={form.contactTuteur||""} onChange={chg("contactTuteur")} placeholder="622 000 000"/>
        <div style={{gridColumn:"1/-1"}}><Input label={t("enrolment.parentage")} value={form.filiation||""} onChange={chg("filiation")} placeholder={t("accounting.quick.parentagePlaceholder")}/></div>
        <div style={{gridColumn:"1/-1"}}><Input label={t("accounting.cols.address")} value={form.domicile||""} onChange={chg("domicile")} placeholder={t("accounting.quick.addressPlaceholder")}/></div>
        {/* Une fratrie arrive le même jour : la date est conservée d'un élève
            au suivant, comme le tuteur et le domicile. */}
        <Input label={t("accounting.quick.arrivalDate")} type="date" value={form.dateArrivee||""} onChange={chg("dateArrivee")}/>
      </div>
    </div>
    <div style={{background:"#fafafa",border:"1px solid #e5e7eb",borderRadius:10,padding:"12px 14px"}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"#374151",textTransform:"uppercase",letterSpacing:"0.06em"}}>
        🎓 {t("accounting.quick.toEnrol")}
      </p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        {/* i18n-ignore */}
        <Input label={t("accounting.quick.lastNameReq")} value={form.nom||""} onChange={chg("nom")} placeholder="Bah"/>
        {/* i18n-ignore */}
        <Input label={t("accounting.quick.firstNameReq")} value={form.prenom||""} onChange={chg("prenom")} placeholder="Aminata"/>
        {/* Maternelle : le surnom de la maison, celui auquel l'enfant répond. */}
        {section==="prescolaire"&&<Input label={t("accounting.enrol.nickname")} value={form.surnom||""}
          onChange={chg("surnom")} maxLength={SURNOM_MAX} placeholder={t("accounting.enrol.nicknamePlaceholder")}/>}
        {/* Une fratrie s'étale souvent sur plusieurs cycles : chaque élève
            est inscrit dans SA section (classes, matricule, liste). */}
        {sections.length>1&&<Selec label={t("accounting.enrol.sectionField")} value={section} onChange={changerSection}>
          {sections.map(s=><option key={s} value={s}>{libelleSection(s)}</option>)}
        </Selec>}
        <Champ label={t("enrolment.class")}>
          <select value={form.classe||""} onChange={chg("classe")}
            style={{width:"100%",border:"1px solid #b0c4d8",borderRadius:7,padding:"7px 10px",fontSize:13,background:"#fff",boxSizing:"border-box",outline:"none"}}>
            <option value="">{t("enrolment.select")}</option>
            {getClassesForSection(section, getSystemeScolaire(schoolInfo)).map(c=><option key={c}>{c}</option>)}
          </select>
        </Champ>
        <Selec label={t("enrolment.sex")} value={form.sexe||"M"} onChange={chg("sexe")}>
          <option value="M">{t("enrolment.male")}</option><option value="F">{t("enrolment.female")}</option>
        </Selec>
        <Input label={t("enrolment.dateOfBirth")} type="date" value={form.dateNaissance||""} onChange={chg("dateNaissance")}/>
        {/* Valeurs enregistrées en français ; seul le texte affiché est traduit. */}
        {/* i18n-ignore */}
        <Selec label={t("enrolment.enrollmentType")} value={form.typeInscription||"Première inscription"} onChange={chg("typeInscription")}>
          {/* i18n-ignore */}
          <option value="Première inscription">{t("enrolment.firstEnrollment")}</option><option value="Réinscription">{t("enrolment.reEnrollment")}</option>
        </Selec>
        <Champ label={t("accounting.quick.matriculeAuto")}>
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
      <Btn v="ghost" onClick={()=>setModal(null)} disabled={enCours}>{ajoutes.length?t("common.close"):t("common.cancel")}</Btn>
      <Btn v="ghost" onClick={eleveSuivant} disabled={enCours}>➕ {t("accounting.quick.next")}</Btn>
      <Btn onClick={terminer} disabled={enCours}>{enCours?`⏳ ${t("accounting.collect.saving")}`:`✅ ${t("accounting.quick.finish")}`}</Btn>
    </div>
  </Modale>);
}

function RecapInscrits({ ajoutes }) {
  const { t } = useTranslation();
  if (!ajoutes.length) return null;
  return (
    <div style={{marginTop:12,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 14px",fontSize:12,color:"#166534",textAlign:"left"}}>
      <strong>✅ {t("accounting.quick.recap", { count: ajoutes.length })}</strong>
      <ul style={{margin:"6px 0 0",paddingLeft:18}}>
        {ajoutes.map((e,i)=><li key={`${e.matricule}-${i}`}>{e.prenom} {e.nom} — {e.classe} ({libelleSection(e.niveau)}) · <span style={{fontFamily:"monospace"}}>{e.matricule}</span></li>)}
      </ul>
    </div>
  );
}
