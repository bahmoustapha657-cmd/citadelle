import React from "react";
import { C } from "../constants";
import { GlobalStyles } from "../styles";
import Logo from "../Logo";

function LandingEduGest({onConnexion, onInscription}) {
  return (
    <div style={{minHeight:"100vh",background:"#0A1628",fontFamily:"'Inter','Segoe UI',sans-serif",color:"#fff",overflowX:"hidden"}}>
      <GlobalStyles/>

      {/* ── NAV ── */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(10,22,40,0.92)",backdropFilter:"blur(12px)",borderBottom:"1px solid rgba(255,255,255,0.07)",padding:"0 24px",height:60,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:22}}>🏫</span>
          <span style={{fontSize:20,fontWeight:900,color:"#00C48C",letterSpacing:"-0.5px"}}>EduGest</span>
          <span style={{fontSize:10,color:"rgba(255,255,255,0.35)",fontWeight:600,letterSpacing:"2px",textTransform:"uppercase",marginLeft:4}}>SaaS Scolaire</span>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onConnexion} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Connexion
          </button>
          <button onClick={onInscription} style={{background:"#00C48C",border:"none",color:"#fff",padding:"8px 20px",borderRadius:8,fontSize:13,fontWeight:700,cursor:"pointer"}}>
            Créer mon école →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{padding:"80px 24px 60px",textAlign:"center",maxWidth:860,margin:"0 auto",position:"relative"}}>
        {/* Cercles déco */}
        <div style={{position:"absolute",top:-40,left:"10%",width:320,height:320,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,196,140,0.12) 0%,transparent 70%)",pointerEvents:"none"}}/>
        <div style={{position:"absolute",top:60,right:"5%",width:200,height:200,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,140,255,0.09) 0%,transparent 70%)",pointerEvents:"none"}}/>

        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(0,196,140,0.12)",border:"1px solid rgba(0,196,140,0.3)",borderRadius:20,padding:"6px 16px",marginBottom:28}}>
          <span style={{width:6,height:6,borderRadius:"50%",background:"#00C48C",display:"inline-block"}}/>
          <span style={{fontSize:12,fontWeight:700,color:"#00C48C",letterSpacing:"0.5px"}}>Conçu pour l'Afrique de l'Ouest</span>
        </div>

        <h1 style={{fontSize:"clamp(28px,6vw,54px)",fontWeight:900,lineHeight:1.15,margin:"0 0 20px",letterSpacing:"-1px"}}>
          La gestion scolaire <span style={{color:"#00C48C"}}>simple</span>,<br/>
          <span style={{color:"#00C48C"}}>complète</span> et <span style={{color:"#00C48C"}}>accessible</span>
        </h1>
        <p style={{fontSize:"clamp(14px,2.5vw,18px)",color:"rgba(255,255,255,0.6)",maxWidth:560,margin:"0 auto 40px",lineHeight:1.7}}>
          Gérez élèves, enseignants, finances et bulletins depuis un seul outil.
          Aucune installation. Disponible sur tous les appareils.
        </p>

        <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={onInscription} style={{background:"linear-gradient(135deg,#00C48C,#00a876)",border:"none",color:"#fff",padding:"15px 36px",borderRadius:30,fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 28px rgba(0,196,140,0.4)",letterSpacing:0.3}}>
            🚀 Créer mon école gratuitement
          </button>
          <button onClick={onConnexion} style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.2)",color:"#fff",padding:"15px 32px",borderRadius:30,fontSize:15,fontWeight:700,cursor:"pointer"}}>
            Se connecter →
          </button>
        </div>
        <p style={{marginTop:14,fontSize:11,color:"rgba(255,255,255,0.3)"}}>Inscription gratuite · Aucune carte bancaire requise</p>
      </div>

      {/* ── STATS ── */}
      <div style={{padding:"10px 24px 50px",display:"flex",justifyContent:"center",gap:"clamp(20px,5vw,60px)",flexWrap:"wrap"}}>
        {[
          {v:"100%",l:"Cloud & accessible"},
          {v:"6",l:"Modules intégrés"},
          {v:"∞",l:"Élèves & enseignants"},
          {v:"0€",l:"Pour démarrer"},
        ].map(s=>(
          <div key={s.l} style={{textAlign:"center"}}>
            <div style={{fontSize:"clamp(26px,5vw,38px)",fontWeight:900,color:"#00C48C"}}>{s.v}</div>
            <div style={{fontSize:12,color:"rgba(255,255,255,0.45)",marginTop:2}}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* ── MODULES ── */}
      <div style={{padding:"0 24px 60px",maxWidth:960,margin:"0 auto"}}>
        <h2 style={{textAlign:"center",fontSize:"clamp(18px,3vw,26px)",fontWeight:800,marginBottom:8}}>Tout ce dont votre école a besoin</h2>
        <p style={{textAlign:"center",color:"rgba(255,255,255,0.45)",fontSize:13,marginBottom:36}}>6 modules complets, dans une seule interface</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:14}}>
          {[
            {icon:"🎒",name:"Primaire",desc:"Maternelle → CM2 : classes, notes /10, bulletins, absences, emplois du temps."},
            {icon:"🏫",name:"Secondaire",desc:"Collège & Lycée : matières, coefficients, moyennes par trimestre."},
            {icon:"📊",name:"Comptabilité",desc:"Scolarités, salaires, bons, révisions, personnel administratif."},
            {icon:"👨‍🏫",name:"Portail Enseignant",desc:"Espace dédié : emploi du temps, saisie de notes, fiche de paie."},
            {icon:"👨‍👩‍👧",name:"Portail Parent",desc:"Suivi en temps réel : notes, absences, bulletins, messagerie."},
            {icon:"💬",name:"Messagerie Parents",desc:"Messages, annonces et communication école-famille depuis une seule interface."},
          ].map(m=>(
            <div key={m.name} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"20px 18px"}}>
              <div style={{fontSize:26,marginBottom:8}}>{m.icon}</div>
              <div style={{fontSize:14,fontWeight:800,color:"#fff",marginBottom:6}}>{m.name}</div>
              <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>{m.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── POURQUOI ── */}
      <div style={{padding:"40px 24px 60px",background:"rgba(0,196,140,0.05)",borderTop:"1px solid rgba(0,196,140,0.12)",borderBottom:"1px solid rgba(0,196,140,0.12)"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <h2 style={{textAlign:"center",fontSize:"clamp(18px,3vw,24px)",fontWeight:800,marginBottom:36}}>Pourquoi choisir EduGest ?</h2>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:20}}>
            {[
              {icon:"🚀",title:"Démarrage immédiat",desc:"Votre espace école est opérationnel le jour même, sans installation ni formation."},
              {icon:"🎨",title:"Identité personnalisée",desc:"Logo, couleurs et nom de l'école intégrés partout — bulletins, cartes d'élèves, en-têtes."},
              {icon:"🔒",title:"Données isolées",desc:"Les données de chaque école sont strictement séparées. Chaque rôle n'accède qu'à ce qui le concerne."},
              {icon:"📱",title:"Responsive",desc:"Fonctionne sur ordinateur, tablette et téléphone. Aucune installation requise."},
            ].map(w=>(
              <div key={w.title} style={{background:"rgba(255,255,255,0.03)",borderRadius:12,padding:"20px 16px",textAlign:"center"}}>
                <div style={{fontSize:28,marginBottom:10}}>{w.icon}</div>
                <div style={{fontSize:13,fontWeight:800,color:"#00C48C",marginBottom:6}}>{w.title}</div>
                <div style={{fontSize:12,color:"rgba(255,255,255,0.5)",lineHeight:1.6}}>{w.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TARIFICATION ── */}
      <div style={{padding:"60px 24px",maxWidth:1060,margin:"0 auto"}}>
        <h2 style={{textAlign:"center",fontSize:"clamp(18px,3vw,26px)",fontWeight:800,marginBottom:8}}>Tarification transparente</h2>
        <p style={{textAlign:"center",color:"rgba(255,255,255,0.45)",fontSize:13,marginBottom:40}}>Démarrez gratuitement, évoluez selon vos besoins</p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:16}}>
          {[
            {
              name:"Gratuit",badge:null,price:"0 GNF",period:"/mois",
              accent:"rgba(255,255,255,0.55)",
              color:"rgba(255,255,255,0.05)",border:"rgba(255,255,255,0.12)",
              features:["Jusqu'à 50 élèves actifs","1 section (Primaire ou Collège)","Notes & bulletins imprimables","Emplois du temps","Support communauté"],
              cta:"Démarrer gratuitement",action:onInscription,highlight:false,
            },
            {
              name:"Starter",badge:null,price:"100 000 GNF",period:"/mois",
              accent:"#0ea5e9",
              color:"rgba(14,165,233,0.07)",border:"rgba(14,165,233,0.4)",
              features:["Jusqu'à 200 élèves actifs","Primaire + Collège","Notes, bulletins, absences","Comptabilité de base","Portail enseignant","Support standard"],
              cta:"Choisir Starter",action:onInscription,highlight:false,
            },
            {
              name:"Standard",badge:"✦ Recommandé",price:"200 000 GNF",period:"/mois",
              accent:"#8b5cf6",
              color:"rgba(139,92,246,0.08)",border:"#8b5cf6",
              features:["Jusqu'à 500 élèves actifs","Toutes les sections","Comptabilité complète & salaires","Portail enseignant & parent","Exports & impressions avances","Support prioritaire"],
              cta:"Choisir Standard",action:onInscription,highlight:true,
            },
            {
              name:"Premium",badge:null,price:"500 000 GNF",period:"/mois",
              accent:"#f59e0b",
              color:"rgba(245,158,11,0.07)",border:"rgba(245,158,11,0.5)",
              features:["Élèves illimités","Toutes les sections","Toutes les fonctionnalités","Personnalisation avancée","Multi-utilisateurs","Support dédié 7j/7"],
              cta:"Choisir Premium",action:onInscription,highlight:false,
            },
          ].map(plan=>(
            <div key={plan.name} style={{
              background:plan.color,border:`2px solid ${plan.border}`,borderRadius:18,
              padding:"26px 20px",position:"relative",
              boxShadow:plan.highlight?"0 0 40px rgba(139,92,246,0.2)":"none",
            }}>
              {plan.badge&&<div style={{position:"absolute",top:-12,left:"50%",transform:"translateX(-50%)",
                background:plan.accent,color:"#fff",fontSize:11,fontWeight:800,
                padding:"4px 14px",borderRadius:20,whiteSpace:"nowrap"}}>{plan.badge}</div>}
              <div style={{fontSize:15,fontWeight:800,color:plan.accent,marginBottom:6}}>{plan.name}</div>
              <div style={{fontSize:"clamp(18px,3vw,26px)",fontWeight:900,color:"#fff",lineHeight:1.1}}>
                {plan.price}
                {plan.period&&<span style={{fontSize:12,fontWeight:400,color:"rgba(255,255,255,0.4)"}}>{plan.period}</span>}
              </div>
              <div style={{height:1,background:"rgba(255,255,255,0.08)",margin:"16px 0"}}/>
              <ul style={{listStyle:"none",padding:0,margin:"0 0 22px",display:"flex",flexDirection:"column",gap:8}}>
                {plan.features.map(f=>(
                  <li key={f} style={{display:"flex",alignItems:"flex-start",gap:8,fontSize:12,color:"rgba(255,255,255,0.7)"}}>
                    <span style={{color:plan.accent,fontWeight:800,marginTop:1,flexShrink:0}}>✓</span>{f}
                  </li>
                ))}
              </ul>
              <button onClick={plan.action} style={{
                width:"100%",padding:"11px",borderRadius:10,fontSize:13,fontWeight:800,cursor:"pointer",
                background:plan.highlight?`linear-gradient(135deg,${plan.accent},#6d28d9)`:"rgba(255,255,255,0.08)",
                border:plan.highlight?"none":`1px solid ${plan.border}`,
                color:"#fff",
              }}>{plan.cta}</button>
            </div>
          ))}
        </div>
        <p style={{textAlign:"center",marginTop:20,fontSize:11,color:"rgba(255,255,255,0.25)"}}>
          Tarifs en Francs Guinéens (GNF) · Facturation mensuelle · Période de grâce 7 jours après expiration
        </p>
      </div>

      {/* ── TÉMOIGNAGES ── */}
      <div style={{padding:"50px 24px 70px",background:"rgba(255,255,255,0.02)",borderTop:"1px solid rgba(255,255,255,0.05)"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <h2 style={{textAlign:"center",fontSize:"clamp(18px,3vw,24px)",fontWeight:800,marginBottom:8}}>Ils nous font confiance</h2>
          <p style={{textAlign:"center",color:"rgba(255,255,255,0.4)",fontSize:13,marginBottom:36}}>Des directeurs d'établissements qui ont transformé leur gestion</p>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:16}}>
            {[
              {
                nom:"Mamadou Diallo",poste:"Directeur, Groupe Scolaire Excellence",ville:"Conakry",
                texte:"EduGest a révolutionné notre façon de gérer les 3 sections de notre groupe. La génération automatique des bulletins nous économise des jours de travail.",
                note:5,
              },
              {
                nom:"Fatoumata Camara",poste:"Directrice, Institut Sainte-Marie",ville:"Kankan",
                texte:"L'emploi du temps général et les états de salaires sont maintenant prêts en quelques clics. Je recommande à tous les établissements privés.",
                note:5,
              },
              {
                nom:"Ibrahima Bah",poste:"Administrateur, Lycée Avenir",ville:"Labé",
                texte:"Le portail parent permet aux familles de suivre les notes en temps réel. Les demandes de bulletins ont diminué de 70% depuis que nous utilisons EduGest.",
                note:5,
              },
            ].map(t=>(
              <div key={t.nom} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:14,padding:"22px 18px"}}>
                <div style={{display:"flex",gap:3,marginBottom:12}}>
                  {Array.from({length:t.note}).map((_,i)=><span key={i} style={{color:"#f59e0b",fontSize:14}}>★</span>)}
                </div>
                <p style={{fontSize:13,color:"rgba(255,255,255,0.65)",lineHeight:1.7,margin:"0 0 18px",fontStyle:"italic"}}>
                  « {t.texte} »
                </p>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:"linear-gradient(135deg,#00C48C,#0A1628)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:800,color:"#fff",flexShrink:0}}>
                    {t.nom.charAt(0)}
                  </div>
                  <div>
                    <div style={{fontSize:12,fontWeight:800,color:"#fff"}}>{t.nom}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{t.poste}</div>
                    <div style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>{t.ville}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA FINAL ── */}
      <div style={{padding:"60px 24px 80px",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(20px,3.5vw,30px)",fontWeight:900,marginBottom:14}}>
          Prêt à digitaliser votre école ?
        </h2>
        <p style={{color:"rgba(255,255,255,0.5)",fontSize:14,marginBottom:32}}>Rejoignez les établissements qui font confiance à EduGest</p>
        <button onClick={onInscription} style={{background:"linear-gradient(135deg,#00C48C,#00a876)",border:"none",color:"#fff",padding:"16px 44px",borderRadius:30,fontSize:16,fontWeight:800,cursor:"pointer",boxShadow:"0 8px 28px rgba(0,196,140,0.4)"}}>
          🏫 Créer mon école gratuitement
        </button>
        <div style={{marginTop:14,fontSize:12,color:"rgba(255,255,255,0.3)"}}>
          Déjà inscrit ?{" "}
          <button onClick={onConnexion} style={{background:"none",border:"none",color:"#00C48C",fontSize:12,fontWeight:700,cursor:"pointer",padding:0,textDecoration:"underline"}}>
            Se connecter
          </button>
        </div>

        {/* Contact EduGest */}
        <div style={{marginTop:36,display:"flex",justifyContent:"center",gap:16,flexWrap:"wrap"}}>
          <a href="https://wa.me/+224627738579" target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"center",gap:8,background:"rgba(0,196,140,0.1)",
              border:"1px solid rgba(0,196,140,0.3)",borderRadius:10,padding:"10px 20px",
              textDecoration:"none",color:"#00C48C",fontSize:13,fontWeight:700}}>
            💬 +224 627 738 579
          </a>
          <a href="https://mail.google.com/mail/?view=cm&to=edugest26@gmail.com" target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"center",gap:8,background:"rgba(139,92,246,0.1)",
              border:"1px solid rgba(139,92,246,0.3)",borderRadius:10,padding:"10px 20px",
              textDecoration:"none",color:"#a78bfa",fontSize:13,fontWeight:700}}>
            ✉️ edugest26@gmail.com
          </a>
        </div>
      </div>

      {/* ── FOOTER ── */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.07)",padding:"24px",display:"flex",flexWrap:"wrap",gap:10,justifyContent:"space-between",alignItems:"center"}}>
        <div style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>
          © {new Date().getFullYear()} EduGest · Solution SaaS de gestion scolaire pour l'Afrique
        </div>
        <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
          <a href="https://wa.me/+224627738579" target="_blank" rel="noopener noreferrer"
            style={{color:"rgba(255,255,255,0.3)",fontSize:11,textDecoration:"none"}}>
            💬 +224 627 738 579
          </a>
          <a href="https://mail.google.com/mail/?view=cm&to=edugest26@gmail.com" target="_blank" rel="noopener noreferrer"
            style={{color:"rgba(255,255,255,0.3)",fontSize:11,textDecoration:"none"}}>
            ✉️ edugest26@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
//  PORTAIL PUBLIC (page d'accueil avant connexion)
// ══════════════════════════════════════════════════════════════

export { LandingEduGest };
