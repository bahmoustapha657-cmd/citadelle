import { C, getNiveauxExamen, getSystemeScolaire } from "../../constants";
import { Btn, Card } from "../ui";
import { usePassageAdmis } from "./promotion-card/use-passage-admis";
import { PassageAdmisResultats } from "./promotion-card/PassageAdmisResultats";
import { dateLongue } from "./cloture-annee-utils";

// Passage des admis aux examens nationaux de fin de cycle (CEE, BEPC, BAC) :
// les classes d'examen ne passent pas sur nos moyennes, la promotion les
// laisse donc de côté. Ici, seul compte le résultat saisi sur la fiche.
export function PassageAdmisCard({ schoolId, schoolInfo, toast, userRole }) {
  const pa = usePassageAdmis({ schoolId, schoolInfo, toast });
  // Même garde que la promotion : opération de masse, réservée à la Direction.
  const peutLancer = userRole === "direction" || userRole === "superadmin";
  const niveaux = getNiveauxExamen(getSystemeScolaire(schoolInfo || {})).join(", ");
  const dernier = schoolInfo?.passagesAdmis?.[pa.annee];

  return (
    <Card style={{marginBottom:20,padding:"16px 20px",border:"2px solid #ede9fe"}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:14}}>
        <span style={{fontSize:28}}>📝</span>
        <div style={{flex:1}}>
          <p style={{margin:"0 0 4px",fontWeight:800,fontSize:14,color:C.blueDark}}>Passage des admis aux examens {pa.annee}</p>
          <p style={{margin:"0 0 12px",fontSize:12,color:"#6b7280"}}>
            Classes d'examen ({niveaux}) de l'année clôturée : le passage suit le <strong>résultat saisi</strong> sur
            la fiche de chaque élève (Comptabilité → Élèves → Résultat d'examen), pas les moyennes. L'admis passe
            en classe supérieure ; l'admis sans suite possible dans l'établissement (Terminale, ou section suivante
            non ouverte) devient « Diplômé » ; le refusé redouble. À relancer à mesure que les résultats arrivent :
            un élève déjà passé n'est jamais déplacé deux fois.
          </p>
          {dernier&&<p style={{margin:"0 0 12px",fontSize:12,color:C.greenDk,fontWeight:600}}>
            Dernier passage appliqué le {dateLongue(new Date(dernier.le))} — au total {dernier.passes} passé(s), {dernier.diplomes} diplômé(s).
          </p>}
          <PassageAdmisResultats res={pa.resultat}/>
          {peutLancer ? (
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <Btn v="purple" onClick={()=>pa.lancer(true)} disabled={pa.enCours}>
                {pa.enCours?"⏳ En cours…":"🔍 Simuler le passage des admis"}
              </Btn>
              {pa.resultat?.simulation&&(pa.resultat.passes+pa.resultat.diplomes)>0&&(
                <Btn onClick={()=>pa.lancer(false)} disabled={pa.enCours}>✅ Appliquer ce passage</Btn>
              )}
              {pa.resultat&&<Btn v="ghost" onClick={()=>pa.setResultat(null)}>Effacer le résultat</Btn>}
            </div>
          ) : (
            <p style={{margin:0,fontSize:12,color:"#9ca3af",fontStyle:"italic"}}>
              🔒 Action réservée à la Direction Générale.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
