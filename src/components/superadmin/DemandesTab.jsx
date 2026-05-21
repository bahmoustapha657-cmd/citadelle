import React from "react";
import { C, PLANS } from "../../constants";

// Onglet "Demandes" du Panel Super-Admin.
// Liste les demandes d'activation de plan (Pro, etc.) émises par les
// écoles avec preuves de paiement Mobile Money. Le superadmin peut
// valider (active le plan + écrit lastSuccessfulPaymentId) ou rejeter.
export function DemandesTab({ demandes, validerDemande, rejeterDemande, S }) {
  return (
    <div style={S.card}>
      {demandes.length===0 ? (
        <div style={{padding:40,textAlign:"center",color:"#9ca3af"}}>Aucune demande de souscription.</div>
      ) : (
        <div className="lc-sticky-wrap" style={{border:"none",borderRadius:0}}>
        <table className="lc-sticky-table" data-fix-left="1">
          <thead>
            <tr>
              {["Ecole","Plan demande","Operateur","Telephone","Reference","Date","Statut","Actions"].map(h=>(
                <th key={h} style={S.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {demandes.map(d=>(
              <tr key={d._id}>
                <td style={S.td}><strong>{d.ecoleNom||d._schoolId}</strong></td>
                <td style={S.td}>
                  {d.planDemande ? (
                    <span style={{display:"inline-block",padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:800,
                      background:PLANS[d.planDemande]?.bg||"#f3f4f6",color:PLANS[d.planDemande]?.couleur||"#6b7280"}}>
                      {PLANS[d.planDemande]?.label||d.planDemande}
                    </span>
                  ):"-"}
                </td>
                <td style={S.td}>{d.operateur||"-"}</td>
                <td style={S.td}>{d.telephone}</td>
                <td style={S.td}><code style={{background:"#f0f4f8",padding:"2px 7px",borderRadius:4,fontSize:11}}>{d.reference}</code></td>
                <td style={S.td}>{d.createdAt?new Date(d.createdAt).toLocaleDateString("fr-FR"):"-"}</td>
                <td style={S.td}>
                  <span style={{...S.badge(d.statut==="validee"),
                    background:d.statut==="validee"?"#d1fae5":d.statut==="rejetee"?"#fee2e2":"#fef3c7",
                    color:d.statut==="validee"?"#065f46":d.statut==="rejetee"?"#991b1b":"#92400e"}}>
                    {d.statut==="validee"?"Validee":d.statut==="rejetee"?"Rejetee":"En attente"}
                  </span>
                </td>
                <td style={S.td}>
                  {d.statut==="en_attente" && (
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>validerDemande(d)}
                        style={{...S.btn(C.green),background:"#d1fae5",color:"#065f46"}}>
                        Valider
                      </button>
                      <button onClick={()=>rejeterDemande(d)}
                        style={{...S.btn("#ef4444"),background:"#fee2e2",color:"#991b1b"}}>
                        Rejeter
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
