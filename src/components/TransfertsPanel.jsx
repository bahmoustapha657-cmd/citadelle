import React, { useState, useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, fmt, today } from "../constants";
import { getAuthHeaders } from "../apiClient";
import { imprimerCertificatRadiation, imprimerOrdreMutation } from "../reports";
import { Badge, Btn, Card, Input, Modale, Stat, TD, THead, TR, Vide } from "./ui";

function TransfertsPanel({userRole, annee, setTab}) {
  const {schoolId, schoolInfo, moisAnnee, toast} = useContext(SchoolContext);
  const {items:elevesC} = useFirestore("elevesCollege");
  const {items:elevesP} = useFirestore("elevesPrimaire");
  const {items:elevesL} = useFirestore("elevesLycee");
  const {items:tarifsClasses} = useFirestore("tarifs");
  const canEdit = !["enseignant"].includes(userRole);

  const [sousTab, setSousTab] = useState("sortants"); // sortants | entrants
  const [modalSortant, setModalSortant] = useState(null);
  const [tokenInput, setTokenInput] = useState("");
  const [transfertData, setTransfertData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [transfertsSortants, setTransfertsSortants] = useState([]);

  const tousEleves = [...elevesC, ...elevesP, ...elevesL];
  const partis = tousEleves.filter(e=>["Transféré"].includes(e.statut));

  const getTarif = (classe) => {
    const t = tarifsClasses.find(t=>t.classe===classe);
    return Number(t?.montant||0);
  };

  const getSolde = (eleve) => {
    const mens = eleve.mens||{};
    const nbImpayes = moisAnnee.filter(m=>mens[m]!=="Payé").length;
    return nbImpayes * getTarif(eleve.classe);
  };

  // Génère un token de transfert (Phase 2)
  const genererToken = async (eleve, ecoleDestination) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await fetch("/api/transfert", {
        method:"POST",
        headers,
        body: JSON.stringify({
          action: "generer",
          schoolId,
          eleveSnapshot: {
            ...eleve,
            schoolNom: schoolInfo.nom||"",
            solde: getSolde(eleve),
          },
          ecoleDestination,
        }),
      });
      const data = await res.json();
      if(data.token) {
        setTransfertsSortants(prev=>[{...data, eleveNom:`${eleve.nom} ${eleve.prenom}`, classe:eleve.classe, dateCreation:today()}, ...prev]);
        toast(`Token généré : ${data.token}`, "success");
        setModalSortant({...eleve, token:data.token, ecoleDestination});
      } else {
        toast(data.error||"Erreur lors de la génération","error");
      }
    } catch(e) {
      toast("Erreur réseau : "+e.message,"error");
    } finally { setLoading(false); }
  };

  // Vérifie un token entrant (Phase 2)
  const verifierToken = async () => {
    if(!tokenInput.trim()){toast("Saisissez un token","warning");return;}
    setLoading(true);
    try {
      const headers = await getAuthHeaders({});
      const res = await fetch(`/api/transfert?token=${encodeURIComponent(tokenInput.trim())}`, {headers});
      const data = await res.json();
      if(data.eleveSnapshot) setTransfertData(data);
      else toast(data.error||"Token introuvable ou expiré","error");
    } catch(e) {
      toast("Erreur réseau : "+e.message,"error");
    } finally { setLoading(false); }
  };

  // Accepte un transfert entrant et importe l'élève
  const accepterTransfert = async () => {
    if(!transfertData) return;
    setLoading(true);
    try {
      const headers = await getAuthHeaders({"Content-Type":"application/json"});
      const res = await fetch("/api/transfert", {
        method:"POST", headers,
        body: JSON.stringify({action:"accepter", token:tokenInput, targetSchoolId:schoolId}),
      });
      const data = await res.json();
      if(data.ok) {
        toast("Élève importé avec succès","success");
        setTransfertData(null); setTokenInput("");
      } else {
        toast(data.error||"Erreur lors de l'acceptation","error");
      }
    } catch(e) {
      toast("Erreur réseau : "+e.message,"error");
    } finally { setLoading(false); }
  };

  return (
    <div>
      {/* Sous-tabs */}
      <div style={{display:"flex",gap:6,background:"#f1f5f9",borderRadius:10,padding:4,marginBottom:18,width:"fit-content"}}>
        {[["sortants","📤 Transferts sortants"],["entrants","📥 Transferts entrants"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setSousTab(id)}
            style={{padding:"7px 16px",border:"none",borderRadius:7,cursor:"pointer",fontSize:12,fontWeight:700,
              background:sousTab===id?"#fff":"transparent",
              color:sousTab===id?C.blueDark:"#64748b",
              boxShadow:sousTab===id?"0 1px 4px rgba(0,0,0,0.08)":"none"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── SORTANTS ── */}
      {sousTab==="sortants"&&<>
        <p style={{fontSize:12,color:"#6b7280",marginBottom:14}}>
          Générez les documents officiels et les tokens de transfert pour les élèves marqués "Transféré".
        </p>
        {partis.length===0
          ? <Vide icone="📤" msg="Aucun élève marqué 'Transféré' — déclarez un départ depuis l'onglet Enrôlement"/>
          : <Card>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <THead cols={["Matricule","Élève","Classe","Date départ","Destination","Solde dû","Documents","Token EduGest"]}/>
                <tbody>{partis.map(e=>{
                  const solde = getSolde(e);
                  const token = transfertsSortants.find(t=>t.eleveId===e._id||t.eleveNom===`${e.nom} ${e.prenom}`);
                  return <TR key={e._id}>
                    <TD><span style={{fontSize:11,fontFamily:"monospace",background:"#e0ebf8",padding:"2px 5px",borderRadius:4,color:C.blue,fontWeight:700}}>{e.matricule}</span></TD>
                    <TD bold>{e.nom} {e.prenom}</TD>
                    <TD><Badge color="blue">{e.classe}</Badge></TD>
                    <TD>{e.dateDepart||"—"}</TD>
                    <TD><span style={{fontSize:11,color:"#6b7280"}}>{e.destinationDepart||"—"}</span></TD>
                    <TD><span style={{fontWeight:700,color:solde>0?"#b91c1c":"#15803d"}}>{solde>0?fmt(solde):"Apuré"}</span></TD>
                    <TD>
                      <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                        <Btn sm v="ghost" onClick={()=>imprimerOrdreMutation(e,schoolInfo,e.destinationDepart||"",annee)}>📄 Mutation</Btn>
                        <Btn sm v="ghost" onClick={()=>imprimerCertificatRadiation(e,schoolInfo,annee,solde)}>📄 Radiation</Btn>
                      </div>
                    </TD>
                    <TD>
                      {token
                        ? <span style={{fontFamily:"monospace",fontWeight:900,color:C.blue,fontSize:13}}>{token.token}</span>
                        : canEdit&&<Btn sm v="blue" onClick={()=>genererToken(e, e.destinationDepart||"")} disabled={loading}>
                            🔑 Générer
                          </Btn>
                      }
                    </TD>
                  </TR>;
                })}</tbody>
              </table>
            </Card>
        }

        {/* Modal token généré */}
        {modalSortant?.token&&<Modale titre="🔑 Token de transfert généré" fermer={()=>setModalSortant(null)}>
          <p style={{fontSize:13,marginBottom:16}}>
            Remettez ce code à <strong>{modalSortant.nom} {modalSortant.prenom}</strong> ou à son école d'accueil.
          </p>
          <div style={{background:"#f0f9ff",border:"2px solid #38bdf8",borderRadius:12,padding:"20px",textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:28,fontWeight:900,fontFamily:"monospace",color:C.blue,letterSpacing:4}}>{modalSortant.token}</div>
            <div style={{fontSize:11,color:"#0369a1",marginTop:6}}>Valable 30 jours · Usage unique</div>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
            <Btn v="ghost" onClick={()=>setModalSortant(null)}>Fermer</Btn>
            <Btn v="blue" onClick={()=>{navigator.clipboard?.writeText(modalSortant.token);toast("Token copié","success");}}>📋 Copier</Btn>
          </div>
        </Modale>}
      </>}

      {/* ── ENTRANTS ── */}
      {sousTab==="entrants"&&<>
        <p style={{fontSize:12,color:"#6b7280",marginBottom:14}}>
          Importez un élève transféré depuis une autre école EduGest via son token, ou créez manuellement sa fiche.
        </p>

        {/* Import manuel */}
        <Card style={{marginBottom:16,border:"2px solid #e0ebf8"}}>
          <div style={{padding:"14px 18px"}}>
            <p style={{margin:"0 0 10px",fontWeight:800,fontSize:13,color:C.blueDark}}>📥 Importer via token EduGest</p>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              <input value={tokenInput} onChange={e=>setTokenInput(e.target.value.toUpperCase())}
                placeholder="Ex : TRF-A3K9B2"
                style={{flex:1,border:"1.5px solid #b0c4d8",borderRadius:8,padding:"9px 14px",fontSize:14,fontFamily:"monospace",fontWeight:700,letterSpacing:2}}/>
              <Btn v="blue" onClick={verifierToken} disabled={loading}>{loading?"⏳":"🔍 Vérifier"}</Btn>
            </div>

            {transfertData&&<div style={{marginTop:14,background:"#f0fdf4",border:"1px solid #86efac",borderRadius:10,padding:"14px 18px"}}>
              <p style={{margin:"0 0 10px",fontWeight:800,color:"#14532d"}}>✅ Dossier trouvé — {transfertData.eleveSnapshot?.nom} {transfertData.eleveSnapshot?.prenom}</p>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,fontSize:12,marginBottom:12}}>
                <span>Classe : <strong>{transfertData.eleveSnapshot?.classe}</strong></span>
                <span>École d'origine : <strong>{transfertData.eleveSnapshot?.schoolNom}</strong></span>
                <span>Date naissance : <strong>{transfertData.eleveSnapshot?.dateNaissance}</strong></span>
                <span>Situation : <strong style={{color:transfertData.eleveSnapshot?.solde>0?"#b91c1c":"#15803d"}}>{transfertData.eleveSnapshot?.solde>0?`Solde dû : ${fmt(transfertData.eleveSnapshot.solde)}`:"Situation apurée"}</strong></span>
              </div>
              <Btn v="success" onClick={accepterTransfert} disabled={loading}>
                {loading?"⏳ Import en cours…":"✅ Confirmer l'accueil — Créer la fiche élève"}
              </Btn>
            </div>}
          </div>
        </Card>

        <div style={{textAlign:"center",padding:"10px 0",color:"#9ca3af",fontSize:12,marginBottom:12}}>— ou —</div>

        <Card style={{border:"2px dashed #b0c4d8"}}>
          <div style={{padding:"14px 18px"}}>
            <p style={{margin:"0 0 8px",fontWeight:800,fontSize:13,color:C.blueDark}}>📝 Enregistrement manuel (élève venant d'une école hors EduGest)</p>
            <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
              Créez directement la fiche élève depuis l'onglet <strong>Enrôlement</strong>, en complétant le champ "Établissement d'origine" et en sélectionnant "Réinscription" comme type d'inscription.
            </p>
            <Btn sm v="ghost" onClick={()=>setTab&&setTab("enrolment")}>→ Aller à l'Enrôlement</Btn>
          </div>
        </Card>
      </>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PARAMÈTRES MATRICULE (sous-composant)
// ══════════════════════════════════════════════════════════════

export { TransfertsPanel };
