import React, { useState, useContext } from "react";
import { addDoc, collection } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LineChart, Line, ResponsiveContainer } from "recharts";
import { db } from "../firebaseDb";
import { SchoolContext } from "../contexts/SchoolContext";
import { useFirestore } from "../hooks/useFirestore";
import { C, PLANS, fmt, getAnnee } from "../constants";
import { genererRapportMensuel } from "../reports";
import { Badge, Btn, Card, Chargement, Stat, TR, Vide } from "./ui";

function TableauDeBord({annee}) {
  const {schoolId, schoolInfo, moisAnnee, moisSalaire, planInfo} = useContext(SchoolContext);
  const {items:elevesC, chargement:cEC} = useFirestore("elevesCollege");
  const {items:elevesP, chargement:cEP} = useFirestore("elevesPrimaire");
  const {items:elevesL, chargement:cEL} = useFirestore("elevesLycee");
  const {items:ensC}    = useFirestore("ensCollege");
  const {items:ensL}    = useFirestore("ensLycee");
  const {items:ensP}    = useFirestore("ensPrimaire");
  const {items:recettes}= useFirestore("recettes");
  const {items:depenses}= useFirestore("depenses");
  const {items:salaires}= useFirestore("salaires");
  const {items:evenements} = useFirestore("evenements");
  const {items:absences}= useFirestore("absencesCollege");
  const {items:absP}    = useFirestore("absencesPrimaire");
  const {items:absL}    = useFirestore("elevesLycee_absences");
  const [moisRapport,setMoisRapport] = useState(moisSalaire[moisSalaire.length-1]||"");
  const [demandeOuverte, setDemandeOuverte] = useState(false);
  const [demandePlan, setDemandePlan] = useState("starter");
  const [demandeForm, setDemandeForm] = useState({operateur:"Orange Money",telephone:"",reference:""});
  const [demandeEnvoi, setDemandeEnvoi] = useState(false);
  const [demandeSucces, setDemandeSucces] = useState(false);

  const envoyerDemande = async () => {
    if(!demandeForm.telephone.trim()||!demandeForm.reference.trim()) return;
    setDemandeEnvoi(true);
    try {
      await addDoc(collection(db,"ecoles",schoolId,"demandes_plan"),{
        ecoleNom: schoolInfo.nom,
        planDemande: demandePlan,
        operateur: demandeForm.operateur,
        telephone: demandeForm.telephone.trim(),
        reference: demandeForm.reference.trim(),
        statut: "en_attente",
        createdAt: Date.now(),
      });
      setDemandeSucces(true);
      // Ne pas fermer le formulaire — montrer le succès à l'intérieur
      setTimeout(()=>{ setDemandeSucces(false); setDemandeOuverte(false); setDemandeForm({operateur:"Orange Money",telephone:"",reference:""}); }, 5000);
    } catch(e){
      console.error(e);
      alert("Erreur lors de l'envoi. Vérifiez votre connexion et réessayez.");
    }
    finally { setDemandeEnvoi(false); }
  };

  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;
  const enChargement = cEC || cEP || cEL;

  const totalEleves = elevesC.filter(e=>e.statut==="Actif").length + elevesL.filter(e=>e.statut==="Actif").length + elevesP.filter(e=>e.statut==="Actif").length;
  const totalEns    = ensC.length + ensL.length + ensP.length;
  const moisActuel  = moisSalaire[moisSalaire.length-1] || "";

  // Taux de paiement mensualités
  const calcTauxPaiement = (eleves) => {
    if(!eleves.length) return 0;
    const moisAnnee = Object.keys((eleves[0]?.mens||{}));
    if(!moisAnnee.length) return 0;
    const total = eleves.length * moisAnnee.length;
    const payes = eleves.reduce((s,e)=>s+Object.values(e.mens||{}).filter(v=>v==="Payé").length,0);
    return total > 0 ? Math.round(payes/total*100) : 0;
  };
  const tauxPayC = calcTauxPaiement(elevesC);
  const tauxPayL = calcTauxPaiement(elevesL);
  const tauxPayP = calcTauxPaiement(elevesP);
  const tauxPay  = calcTauxPaiement([...elevesC, ...elevesL, ...elevesP]);

  // Finances
  const totalRec  = recettes.reduce((s,r)=>s+Number(r.montant||0),0);
  const totalDep  = depenses.reduce((s,d)=>s+Number(d.montant||0),0);
  const solde     = totalRec - totalDep;

  // Masse salariale mois courant
  const salMois = salaires.filter(s=>s.mois===moisActuel);
  const masseSal = salMois.reduce((s,sal)=>{
    const net = Number(sal.vhExecute||0)*Number(sal.primeHoraire||0)
      + Number(sal.cinqSem||0)*Number(sal.primeHoraire||0)
      + Number(sal.bon||0)
      + Number(sal.revision||0)
      + Number(sal.montantForfait||0);
    return s + net;
  },0);

  // Événements à venir
  const today = new Date().toISOString().slice(0,10);
  const evAVenir = evenements.filter(e=>e.date && e.date >= today).sort((a,b)=>a.date>b.date?1:-1).slice(0,4);

  // Absences ce mois
  const totalAbs = absences.length + absP.length + absL.length;

  const KPI = ({label, value, sub, icon, color="white", trend}) => (
    <div style={{background:c1,borderRadius:14,padding:"18px 20px",position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:-12,right:-12,fontSize:48,opacity:0.06}}>{icon}</div>
      <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6}}>{label}</div>
      <div style={{fontSize:"clamp(22px,3vw,30px)",fontWeight:900,color:color==="green"?c2:"#fff",lineHeight:1}}>{value}</div>
      {sub&&<div style={{fontSize:11,color:"rgba(255,255,255,0.4)",marginTop:4}}>{sub}</div>}
      {trend!==undefined&&<div style={{fontSize:11,fontWeight:700,marginTop:6,color:trend>=0?"#4ade80":"#f87171"}}>
        {trend>=0?"▲":"▼"} {Math.abs(trend)}%
      </div>}
    </div>
  );

  const TYPE_COLORS = {exam:"#ef4444",conge:"#10b981",reunion:"#f59e0b",autre:"#6366f1"};

  if(enChargement) return <Chargement type="kpi" cols={6}/>;

  return (
    <div style={{padding:"22px 26px",maxWidth:1200}}>
      {/* En-tête */}
      <div style={{marginBottom:24,display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:20,fontWeight:900,color:c1}}>
            Tableau de bord — {schoolInfo.nom||"EduGest"}
          </h1>
          <p style={{margin:"4px 0 0",fontSize:13,color:"#6b7280"}}>Année {annee||getAnnee()} · Vue consolidée</p>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <select value={moisRapport} onChange={e=>setMoisRapport(e.target.value)}
            style={{border:"1px solid #b0c4d8",borderRadius:8,padding:"6px 10px",fontSize:12,background:"#fff",color:c1,fontWeight:600}}>
            {moisAnnee.map(m=><option key={m}>{m}</option>)}
          </select>
          <Btn v="primary" sm onClick={()=>genererRapportMensuel(
            moisRapport,
            [...elevesC,...elevesL,...elevesP],
            [...absences,...absL,...absP],
            annee||getAnnee(),
            schoolInfo,
            moisAnnee
          )}>📄 Rapport mensuel</Btn>
        </div>
      </div>

      {/* KPIs principaux */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:24}}>
        <KPI label="Élèves actifs"  value={totalEleves} icon="🎓" sub={`${elevesC.filter(e=>e.statut==="Actif").length} collège · ${elevesL.filter(e=>e.statut==="Actif").length} lycée · ${elevesP.filter(e=>e.statut==="Actif").length} primaire`}/>
        <KPI label="Enseignants"    value={totalEns}    icon="👨‍🏫" sub={`${ensC.length}C · ${ensL.length}L · ${ensP.length}P`}/>
        <KPI label="Taux paiement"  value={`${tauxPay}%`} icon="💳" color="green" sub="Mensualités toutes sections"/>
        <KPI label="Solde tréso."   value={fmt(solde)} icon="💰" color={solde>=0?"green":"white"} sub={`Rec: ${fmt(totalRec)} / Dép: ${fmt(totalDep)}`}/>
        <KPI label="Masse salariale" value={fmt(masseSal)} icon="📋" sub={`${salMois.length} lignes · ${moisActuel}`}/>
        <KPI label="Absences saisies" value={totalAbs} icon="📝" sub="Toutes sections"/>
      </div>

      {/* Graphiques */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16,marginBottom:20}}>
        {/* Répartition élèves par classe */}
        <Card><div style={{padding:"16px 18px"}}>
          <p style={{margin:"0 0 14px",fontWeight:800,fontSize:13,color:c1}}>Répartition des élèves par section</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={[
              {section:"Collège",Actifs:elevesC.filter(e=>e.statut==="Actif").length,Inactifs:elevesC.filter(e=>e.statut!=="Actif").length},
              {section:"Lycée",Actifs:elevesL.filter(e=>e.statut==="Actif").length,Inactifs:elevesL.filter(e=>e.statut!=="Actif").length},
              {section:"Primaire",Actifs:elevesP.filter(e=>e.statut==="Actif").length,Inactifs:elevesP.filter(e=>e.statut!=="Actif").length},
            ]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
              <XAxis dataKey="section" tick={{fontSize:11}}/>
              <YAxis tick={{fontSize:11}}/>
              <Tooltip/>
              <Bar dataKey="Actifs" fill={c2} radius={[4,4,0,0]} name="Actifs"/>
              <Bar dataKey="Inactifs" fill="#e2e8f0" radius={[4,4,0,0]} name="Inactifs"/>
            </BarChart>
          </ResponsiveContainer>
        </div></Card>

        {/* Taux de paiement */}
        <Card><div style={{padding:"16px 18px"}}>
          <p style={{margin:"0 0 14px",fontWeight:800,fontSize:13,color:c1}}>Taux de paiement</p>
          <div style={{display:"flex",flexDirection:"column",gap:16,marginTop:8}}>
            {[["Collège",tauxPayC],["Lycée",tauxPayL],["Primaire",tauxPayP]].map(([label,taux])=>(
              <div key={label}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                  <span style={{fontSize:12,fontWeight:700,color:c1}}>{label}</span>
                  <span style={{fontSize:12,fontWeight:800,color:taux>=60?C.greenDk:"#ef4444"}}>{taux}%</span>
                </div>
                <div style={{background:"#e0ebf8",borderRadius:6,height:10}}>
                  <div style={{background:taux>=60?c2:"#ef4444",borderRadius:6,height:10,width:`${taux}%`,transition:"width 0.5s"}}/>
                </div>
              </div>
            ))}
            <div style={{marginTop:8,padding:"10px 12px",background:"#f0fdf8",borderRadius:8,borderLeft:`3px solid ${c2}`}}>
              <div style={{fontSize:11,color:"#374151"}}>Taux global</div>
              <div style={{fontSize:22,fontWeight:900,color:c2}}>{tauxPay}%</div>
            </div>
          </div>
        </div></Card>
      </div>

      {/* ── Tendances annuelles ── */}
      {(()=>{
        // Taux paiement mois par mois pour tous les élèves
        const tousEleves = [...elevesC,...elevesL,...elevesP];
        const dataTendance = moisAnnee.map(m=>{
          const payesMois = tousEleves.filter(e=>(e.mens||{})[m]==="Payé").length;
          const taux = tousEleves.length ? Math.round(payesMois/tousEleves.length*100) : 0;
          const absencesMois = [...absences,...absP,...absL].filter(a=>{
            try { return new Date(a.date).toLocaleDateString("fr-FR",{month:"long"}).toLowerCase()===m.toLowerCase(); } catch { return false; }
          }).length;
          return { mois:m.slice(0,3), taux, absences:absencesMois, payes:payesMois };
        });
        return (
          <Card style={{marginBottom:16}}><div style={{padding:"16px 18px"}}>
            <p style={{margin:"0 0 14px",fontWeight:800,fontSize:13,color:c1}}>Tendances annuelles — {annee||getAnnee()}</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
              {/* Courbe taux paiement */}
              <div>
                <p style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Taux de paiement (%)</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={dataTendance} margin={{top:4,right:8,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                    <XAxis dataKey="mois" tick={{fontSize:10}}/>
                    <YAxis domain={[0,100]} tick={{fontSize:10}} tickFormatter={v=>`${v}%`}/>
                    <Tooltip formatter={(v)=>`${v}%`}/>
                    <Line type="monotone" dataKey="taux" stroke={c2} strokeWidth={2.5} dot={{r:3,fill:c2}} name="Taux paiement"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {/* Courbe absences */}
              <div>
                <p style={{fontSize:11,fontWeight:700,color:"#64748b",margin:"0 0 8px",textTransform:"uppercase",letterSpacing:"0.06em"}}>Absences enregistrées</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={dataTendance} margin={{top:4,right:8,left:-20,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0ebf8"/>
                    <XAxis dataKey="mois" tick={{fontSize:10}}/>
                    <YAxis tick={{fontSize:10}}/>
                    <Tooltip/>
                    <Line type="monotone" dataKey="absences" stroke="#ef4444" strokeWidth={2.5} dot={{r:3,fill:"#ef4444"}} name="Absences"/>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div></Card>
        );
      })()}

      {/* Événements à venir + Alertes */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card><div style={{padding:"16px 18px"}}>
          <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:c1}}>Prochains événements</p>
          {evAVenir.length===0
            ? <Vide icone="📅" msg="Aucun événement planifié"/>
            : evAVenir.map(ev=>(
              <div key={ev._id} style={{display:"flex",alignItems:"flex-start",gap:10,marginBottom:10,padding:"8px 10px",background:"#f8fafc",borderRadius:8,borderLeft:`3px solid ${TYPE_COLORS[ev.type]||"#6366f1"}`}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:800,color:c1}}>{ev.titre}</div>
                  <div style={{fontSize:11,color:"#6b7280"}}>{ev.date} {ev.dateFin&&ev.dateFin!==ev.date?`→ ${ev.dateFin}`:""}</div>
                </div>
                <Badge color={ev.type==="exam"?"red":ev.type==="conge"?"green":ev.type==="reunion"?"orange":"blue"}>{ev.type||"événement"}</Badge>
              </div>
            ))
          }
        </div></Card>

        <Card><div style={{padding:"16px 18px"}}>
          <p style={{margin:"0 0 12px",fontWeight:800,fontSize:13,color:c1}}>Alertes & rappels</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {tauxPay < 60 && (
              <div style={{padding:"10px 12px",background:"#fef3e0",borderRadius:8,borderLeft:"3px solid #f59e0b",fontSize:12}}>
                <span style={{fontWeight:800,color:"#92400e"}}>Taux de paiement bas</span>
                <div style={{color:"#92400e",marginTop:2}}>{tauxPay}% — Relancez les familles en retard.</div>
              </div>
            )}
            {solde < 0 && (
              <div style={{padding:"10px 12px",background:"#fef2f2",borderRadius:8,borderLeft:"3px solid #ef4444",fontSize:12}}>
                <span style={{fontWeight:800,color:"#991b1b"}}>Solde de trésorerie négatif</span>
                <div style={{color:"#991b1b",marginTop:2}}>Solde : {fmt(solde)} GNF</div>
              </div>
            )}
            {masseSal > totalRec * 0.7 && masseSal > 0 && (
              <div style={{padding:"10px 12px",background:"#fef3e0",borderRadius:8,borderLeft:"3px solid #f59e0b",fontSize:12}}>
                <span style={{fontWeight:800,color:"#92400e"}}>Masse salariale élevée</span>
                <div style={{color:"#92400e",marginTop:2}}>{Math.round(masseSal/totalRec*100)}% des recettes ce mois.</div>
              </div>
            )}
            {tauxPay >= 60 && solde >= 0 && (
              <div style={{padding:"10px 12px",background:"#f0fdf8",borderRadius:8,borderLeft:`3px solid ${c2}`,fontSize:12}}>
                <span style={{fontWeight:800,color:"#065f46"}}>Tout va bien</span>
                <div style={{color:"#065f46",marginTop:2}}>Trésorerie positive et taux de paiement satisfaisant.</div>
              </div>
            )}
          </div>
        </div></Card>
      </div>

      {/* ── Bloc abonnement ── */}
      {planInfo && (
        <div style={{marginTop:24}}>

          {/* Bannière expiration / période de grâce / limite */}
          {(planInfo.planEstExpire || planInfo.enPeriodeGrace || planInfo.joursRestants!==null&&planInfo.joursRestants<=30 ||
            planInfo.planCourant==="gratuit"&&planInfo.totalElevesActifs>=40) && (
            <div style={{
              background: planInfo.planEstExpire?"#fee2e2":planInfo.enPeriodeGrace?"#fff7ed":planInfo.joursRestants<=7?"#fef2f2":"#fef3c7",
              border:`1px solid ${planInfo.planEstExpire?"#fca5a5":planInfo.enPeriodeGrace?"#fdba74":planInfo.joursRestants<=7?"#fca5a5":"#fcd34d"}`,
              borderRadius:10,padding:"12px 18px",marginBottom:16,display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"
            }}>
              <span style={{fontSize:22}}>
                {planInfo.planEstExpire?"🔴":planInfo.enPeriodeGrace?"🟠":planInfo.joursRestants<=7?"🔴":"🟡"}
              </span>
              <div style={{flex:1}}>
                <p style={{margin:0,fontWeight:800,fontSize:13,color:planInfo.planEstExpire?"#991b1b":planInfo.enPeriodeGrace?"#c2410c":"#92400e"}}>
                  {planInfo.planEstExpire
                    ? "Abonnement expiré — accès limité à 50 élèves"
                    : planInfo.enPeriodeGrace
                      ? `Période de grâce — encore ${planInfo.joursGrace} jour(s) d'accès complet`
                      : planInfo.joursRestants!==null&&planInfo.joursRestants<=30
                        ? `Abonnement ${planInfo.planLabel} expire dans ${planInfo.joursRestants} jour(s)`
                        : `Plan Gratuit : ${planInfo.totalElevesActifs}/50 élèves — bientôt à la limite`}
                </p>
                <p style={{margin:"2px 0 0",fontSize:11,color:"#6b7280"}}>
                  {planInfo.enPeriodeGrace
                    ? "Renouvelez votre abonnement avant la fin de la période de grâce pour ne pas perdre l'accès."
                    : "Souscrivez un abonnement pour continuer à inscrire des élèves sans limite."}
                </p>
              </div>
            </div>
          )}

          {/* Succès demande envoyée */}
          {demandeSucces && (
            <div style={{background:"#d1fae5",border:"1px solid #6ee7b7",borderRadius:10,padding:"12px 18px",marginBottom:16,fontSize:13,color:"#065f46",fontWeight:700}}>
              ✅ Demande envoyée ! L'équipe EduGest va traiter votre demande et activer votre abonnement.
            </div>
          )}

          <div style={{background:"#fff",borderRadius:14,boxShadow:"0 2px 16px rgba(0,32,80,0.07)",overflow:"hidden"}}>
            <div style={{padding:"16px 20px",borderBottom:"1px solid #f0f0f0",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <div>
                <p style={{margin:0,fontWeight:800,fontSize:14,color:C.blueDark}}>
                  Abonnement — Plan <span style={{color:PLANS[planInfo.planCourant]?.couleur||C.blue}}>{planInfo.planLabel}</span>
                </p>
                <p style={{margin:"3px 0 0",fontSize:12,color:"#6b7280"}}>
                  {planInfo.planCourant==="gratuit"
                    ? `${planInfo.totalElevesActifs}/50 élèves actifs — gratuit jusqu'à 50`
                    : planInfo.planEstExpire
                      ? "Expiré — limité à 50 élèves"
                      : planInfo.enPeriodeGrace
                        ? `Période de grâce — ${planInfo.joursGrace} jour(s) restant(s)`
                        : `${planInfo.totalElevesActifs} élèves actifs · expire le ${new Date(planInfo.planExpiry).toLocaleDateString("fr-FR")}`}
                </p>
              </div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {/* Contact WhatsApp */}
                <a href={`https://wa.me/+224627738579?text=Bonjour%2C%20je%20souhaite%20souscrire%20un%20abonnement%20EduGest%20pour%20l%27%C3%A9cole%20%22${encodeURIComponent(schoolInfo.nom||"")}%22`}
                  target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:6,background:"#dcfce7",color:"#15803d",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,textDecoration:"none",cursor:"pointer"}}>
                  <span>💬</span> WhatsApp
                </a>
                {/* Contact Email */}
                <a href={`https://mail.google.com/mail/?view=cm&to=edugest26@gmail.com&su=${encodeURIComponent("Demande abonnement — "+(schoolInfo.nom||""))}&body=${encodeURIComponent("Bonjour,\nJe souhaite souscrire un abonnement EduGest pour mon école.\n\nÉcole : "+(schoolInfo.nom||"")+"\n")}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{display:"flex",alignItems:"center",gap:6,background:"#ede9fe",color:"#6d28d9",border:"none",borderRadius:8,padding:"8px 14px",fontSize:12,fontWeight:700,textDecoration:"none",cursor:"pointer"}}>
                  <span>✉️</span> Email
                </a>
                {/* Bouton demande formelle */}
                <button onClick={()=>setDemandeOuverte(v=>!v)}
                  style={{display:"flex",alignItems:"center",gap:6,background:`linear-gradient(90deg,${C.blue},${C.green})`,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                  {demandeOuverte?"▲ Fermer":"📋 Demande formelle"}
                </button>
              </div>
            </div>

            {/* Formulaire de demande */}
            {demandeOuverte && (
              <div style={{padding:"20px 24px"}}>
                <p style={{margin:"0 0 16px",fontSize:13,color:"#374151"}}>Remplissez ce formulaire après avoir effectué votre paiement mobile. L'équipe EduGest validera et activera votre abonnement sous 24h.</p>

                {/* Choix du plan */}
                <label style={{display:"block",fontSize:11,fontWeight:700,color:C.blue,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Plan souhaité</label>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:18}}>
                  {Object.entries(PLANS).filter(([k])=>k!=="gratuit").map(([key,info])=>(
                    <button key={key} onClick={()=>setDemandePlan(key)}
                      style={{border:`2px solid ${demandePlan===key?info.couleur:"#e5e7eb"}`,borderRadius:10,padding:"10px 12px",cursor:"pointer",textAlign:"left",background:demandePlan===key?info.bg:"#f9fafb"}}>
                      <div style={{fontWeight:800,fontSize:13,color:info.couleur}}>{info.label}</div>
                      <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{info.eleveLimit===Infinity?"Illimité":`≤ ${info.eleveLimit} élèves`}</div>
                    </button>
                  ))}
                </div>

                {/* Infos paiement */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:"#374151",marginBottom:4}}>Opérateur Mobile Money</label>
                    <select value={demandeForm.operateur} onChange={e=>setDemandeForm(p=>({...p,operateur:e.target.value}))}
                      style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"8px 10px",fontSize:13}}>
                      {["Orange Money","MTN Mobile Money","Moov Money","Wave","Autre"].map(o=><option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{display:"block",fontSize:11,fontWeight:700,color:"#374151",marginBottom:4}}>Numéro de téléphone</label>
                    <input value={demandeForm.telephone} onChange={e=>setDemandeForm(p=>({...p,telephone:e.target.value}))}
                      placeholder="Ex. : 621 00 00 00"
                      style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"8px 10px",fontSize:13,boxSizing:"border-box"}}/>
                  </div>
                </div>
                <div style={{marginBottom:18}}>
                  <label style={{display:"block",fontSize:11,fontWeight:700,color:"#374151",marginBottom:4}}>Référence du paiement</label>
                  <input value={demandeForm.reference} onChange={e=>setDemandeForm(p=>({...p,reference:e.target.value}))}
                    placeholder="Ex. : TXN-20240418-001"
                    style={{width:"100%",border:"1px solid #d1d5db",borderRadius:8,padding:"8px 10px",fontSize:13,boxSizing:"border-box"}}/>
                </div>

                {demandeSucces ? (
                  <div style={{background:"#d1fae5",border:"2px solid #6ee7b7",borderRadius:12,padding:"20px",textAlign:"center"}}>
                    <div style={{fontSize:36,marginBottom:8}}>✅</div>
                    <p style={{margin:"0 0 4px",fontWeight:800,fontSize:15,color:"#065f46"}}>Demande envoyée avec succès !</p>
                    <p style={{margin:0,fontSize:12,color:"#047857"}}>L'équipe EduGest va vérifier votre paiement et activer votre abonnement <strong>{PLANS[demandePlan]?.label}</strong> sous 24h.</p>
                  </div>
                ) : (
                  <div style={{display:"flex",justifyContent:"flex-end"}}>
                    <button onClick={envoyerDemande}
                      disabled={demandeEnvoi||!demandeForm.telephone.trim()||!demandeForm.reference.trim()}
                      style={{background:`linear-gradient(90deg,${C.blue},${C.green})`,color:"#fff",border:"none",padding:"10px 28px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,
                        opacity:(demandeEnvoi||!demandeForm.telephone.trim()||!demandeForm.reference.trim())?0.6:1}}>
                      {demandeEnvoi?"Envoi en cours…":"Envoyer la demande"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PARAMÈTRES MATRICULE (sous-composant)
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
//  COMPOSANT LIVRETS SCOLAIRES
// ══════════════════════════════════════════════════════════════

export { TableauDeBord };
