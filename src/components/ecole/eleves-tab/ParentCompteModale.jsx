import { genererMdp } from "../../../constants";
import { LIENS_PARENT, libelleLien, telephoneLisible } from "../../../comptes-parents";
import { Badge, Btn, Champ, Input, Modale, Selec } from "../../ui";
import { useParentCompte } from "./use-parent-compte";

// Modale « Compte parent » d'un élève (École → Élèves → 👨‍👩‍👧 Compte) : les
// comptes qui le suivent, le rattachement à un compte existant et la
// création. Logique dans use-parent-compte.js ; le contenu est remonté pour
// chaque élève (clé), sans état résiduel d'un élève à l'autre.
export function ParentCompteModale({ parentEleve, ...props }) {
  if (!parentEleve) return null;
  return <Contenu key={parentEleve._id} eleve={parentEleve} {...props}/>;
}

const sousLigne = {fontSize:12,color:"var(--lc-text-muted)",marginTop:2};
const ligne = {display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderTop:"1px solid var(--lc-border-soft)"};
const aide = {margin:"0 0 10px",fontSize:12,color:"var(--lc-text-muted)",lineHeight:1.5};

function Bloc({ titre, children }) {
  return (
    <div style={{marginTop:14,border:"1px solid var(--lc-border)",borderRadius:10,padding:"12px 14px"}}>
      <p style={{margin:"0 0 10px",fontSize:11,fontWeight:800,color:"var(--lc-text-muted)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{titre}</p>
      {children}
    </div>
  );
}

function SelecLien(props) {
  return (
    <Selec {...props}>
      <option value="">—</option>
      {LIENS_PARENT.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
    </Selec>
  );
}

function Contenu({ eleve, fermer, section, schoolId, toast, logAction }) {
  const p = useParentCompte({ eleve, section, schoolId, toast, logAction });
  const chargement = p.gestion && p.lies === null;
  const aDesComptes = (p.lies || []).length > 0;
  const montrerCreation = !p.gestion || p.creationOuverte || !aDesComptes;

  return (
    <Modale titre={`Compte parent — ${eleve.prenom} ${eleve.nom}`} fermer={fermer}>
      <div style={{padding:"10px 14px",background:"#f0fdf4",borderRadius:10,fontSize:12,color:"#166534",lineHeight:1.5}}>
        <strong>{eleve.prenom} {eleve.nom}</strong> — Classe {eleve.classe || "—"} — Tuteur : {eleve.tuteur || "—"}
        {eleve.contactTuteur ? ` · ${telephoneLisible(eleve.contactTuteur)}` : ""}
      </div>

      {p.gestion && (
        <Bloc titre="Comptes parents de l'élève">
          {p.lies === null ? <p style={aide}>Chargement…</p>
            : !aDesComptes ? <p style={aide}>Aucun compte parent pour le moment.</p>
              : p.lies.map((c) => (
                <div key={c.id} style={ligne}>
                  <div style={{flex:1,minWidth:0}}>
                    <strong style={{fontSize:13}}>{c.login}</strong> {c.lien && <Badge color="purple">{libelleLien(c.lien)}</Badge>}
                    <div style={sousLigne}>{[c.nom, c.telephone && telephoneLisible(c.telephone)].filter(Boolean).join(" · ")}</div>
                  </div>
                  <Btn sm v="ghost" onClick={()=>p.detacher(c)} disabled={p.enCours}>Détacher</Btn>
                </div>
              ))}
        </Bloc>
      )}

      {p.gestion && (
        <Bloc titre="Rattacher à un compte existant">
          <p style={aide}>Un frère ou une sœur a déjà un compte parent, dans n'importe quelle section ? Cherchez-le par numéro, nom ou identifiant.</p>
          <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:10}}>
            <Input label="Recherche" value={p.recherche} onChange={(e)=>p.chercher(e.target.value)} placeholder="622 12 34 56, Bah, parent.bah…"/>
            <SelecLien label="Lien avec l'élève" value={p.lienRattachement} onChange={(e)=>p.setLienRattachement(e.target.value)}/>
          </div>
          {p.recherche.trim().length>=2&&(
            p.chargementComptes||!p.comptesCharges ? <p style={{...aide,marginTop:10}}>Recherche…</p>
              : !p.resultats.length ? <p style={{...aide,marginTop:10}}>Aucun compte parent trouvé.</p>
                : <div style={{marginTop:6}}>{p.resultats.map((c) => (
                  <div key={c.id} style={ligne}>
                    <div style={{flex:1,minWidth:0}}>
                      <strong style={{fontSize:13}}>{c.login}</strong>
                      <div style={sousLigne}>
                        {[c.nom, c.telephone && telephoneLisible(c.telephone), `${c.nbEnfants} enfant${c.nbEnfants>1?"s":""}`].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                    <Btn sm v="purple" onClick={()=>p.rattacher(c)} disabled={p.enCours}>Rattacher</Btn>
                  </div>
                ))}</div>
          )}
        </Bloc>
      )}

      {p.cree&&(
        <div style={{marginTop:14,fontSize:12.5,color:"#166534",background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:"10px 12px",lineHeight:1.6}}>
          ✅ Compte créé — identifiant <strong>{p.cree.login}</strong>, mot de passe <strong style={{fontFamily:"monospace"}}>{p.cree.mdp}</strong>. Notez-les et remettez-les au parent.
        </div>
      )}

      {chargement ? null : montrerCreation ? (
        <Bloc titre={aDesComptes ? "Créer un autre compte (second parent)" : "Créer un compte parent"}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <Input label="Nom du parent" value={p.formulaire.nom} onChange={p.champ("nom")} placeholder="Bah Alpha"/>
            <Input label="Téléphone" value={p.formulaire.telephone} onChange={p.champ("telephone")} placeholder="622 12 34 56"/>
            <SelecLien label="Lien avec l'élève" value={p.formulaire.lien} onChange={p.champ("lien")}/>
            <Input label="Identifiant de connexion" value={p.loginSaisi} onChange={p.champ("login")} placeholder="622123456"/>
            <div style={{gridColumn:"1/-1"}}>
              <Champ label="Mot de passe initial">
                <div style={{display:"flex",gap:8}}>
                  <input value={p.formulaire.mdp} onChange={p.champ("mdp")}
                    style={{flex:1,minWidth:0,border:"1.5px solid var(--lc-border)",borderRadius:8,padding:"8px 11px",fontSize:13,fontFamily:"monospace",background:"var(--lc-input-bg)",color:"var(--lc-text)",outline:"none"}}/>
                  <Btn sm v="ghost" onClick={()=>p.setFormulaire((f)=>({...f,mdp:genererMdp()}))}>Régénérer</Btn>
                </div>
              </Champ>
            </div>
          </div>
          <div style={{marginTop:12,padding:"10px 14px",background:"#fef3c7",borderRadius:8,fontSize:12,color:"#92400e",lineHeight:1.5}}>
            Un seul compte par parent, pour tous ses enfants et toutes les sections : si ce parent a déjà un compte (même nom, et même téléphone ou même filiation), l'élève y est ajouté et le mot de passe ne change pas. Son numéro est proposé comme identifiant : facile à retenir.
          </div>
          <div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}>
            <Btn v="purple" onClick={p.creer} disabled={p.enCours}>{p.enCours?"⏳ Enregistrement…":"Créer le compte"}</Btn>
          </div>
        </Bloc>
      ) : (
        <div style={{marginTop:14}}>
          <Btn v="ghost" onClick={()=>p.setCreationOuverte(true)}>＋ Créer un autre compte (second parent)</Btn>
        </div>
      )}

      <div style={{display:"flex",justifyContent:"flex-end",marginTop:16}}>
        <Btn v="ghost" onClick={fermer}>Fermer</Btn>
      </div>
    </Modale>
  );
}
