import { C, fmt } from "../../constants";
import { imprimerCertificatRadiation, imprimerOrdreMutation } from "../../reports";
import { Badge, Btn, Card, Modale, TD, THead, TR, Vide } from "../ui";

// Sous-onglet "Sortants" : tableau des élèves transférés (documents officiels +
// génération de token EduGest) et la modale affichant le token généré.
export function TransfertsSortants({ h, annee }) {
  const { schoolInfo, toast, canEdit, partis, getSolde, transfertsSortants, genererToken, loading, modalSortant, setModalSortant } = h;
  return (
    <>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
        Générez les documents officiels et les tokens de transfert pour les élèves marqués "Transféré".
      </p>
      {partis.length === 0
        ? <Vide icone="📤" msg="Aucun élève marqué 'Transféré' — déclarez un départ depuis l'onglet Enrôlement" />
        : <Card>
            <div className="lc-sticky-wrap"><table className="lc-sticky-table" data-fix-left="1">
              <THead cols={["Matricule", "Élève", "Classe", "Date départ", "Destination", "Solde dû", "Documents", "Token EduGest"]} />
              <tbody>{partis.map(e => {
                const solde = getSolde(e);
                const token = transfertsSortants.find(t => t.eleveId === e._id || t.eleveNom === `${e.nom} ${e.prenom}`);
                return <TR key={e._id}>
                  <TD><span style={{ fontSize: 11, fontFamily: "monospace", background: "#e0ebf8", padding: "2px 5px", borderRadius: 4, color: C.blue, fontWeight: 700 }}>{e.matricule}</span></TD>
                  <TD bold>{e.nom} {e.prenom}</TD>
                  <TD><Badge color="blue">{e.classe}</Badge></TD>
                  <TD>{e.dateDepart || "—"}</TD>
                  <TD><span style={{ fontSize: 11, color: "#6b7280" }}>{e.destinationDepart || "—"}</span></TD>
                  <TD><span style={{ fontWeight: 700, color: solde > 0 ? "#b91c1c" : "#15803d" }}>{solde > 0 ? fmt(solde) : "Apuré"}</span></TD>
                  <TD>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Btn sm v="ghost" onClick={() => imprimerOrdreMutation(e, schoolInfo, e.destinationDepart || "", annee)}>📄 Mutation</Btn>
                      <Btn sm v="ghost" onClick={() => imprimerCertificatRadiation(e, schoolInfo, annee, solde)}>📄 Radiation</Btn>
                    </div>
                  </TD>
                  <TD>
                    {token
                      ? <span style={{ fontFamily: "monospace", fontWeight: 900, color: C.blue, fontSize: 13 }}>{token.token}</span>
                      : canEdit && <Btn sm v="blue" onClick={() => genererToken(e, e.destinationDepart || "")} disabled={loading}>
                          🔑 Générer
                        </Btn>
                    }
                  </TD>
                </TR>;
              })}</tbody>
            </table></div>
          </Card>
      }

      {modalSortant?.token && <Modale titre="🔑 Token de transfert généré" fermer={() => setModalSortant(null)}>
        <p style={{ fontSize: 13, marginBottom: 16 }}>
          Remettez ce code à <strong>{modalSortant.nom} {modalSortant.prenom}</strong> ou à son école d'accueil.
        </p>
        <div style={{ background: "#f0f9ff", border: "2px solid #38bdf8", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", color: C.blue, letterSpacing: 4 }}>{modalSortant.token}</div>
          <div style={{ fontSize: 11, color: "#0369a1", marginTop: 6 }}>Valable 30 jours · Usage unique</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn v="ghost" onClick={() => setModalSortant(null)}>Fermer</Btn>
          <Btn v="blue" onClick={() => { navigator.clipboard?.writeText(modalSortant.token); toast("Token copié", "success"); }}>📋 Copier</Btn>
        </div>
      </Modale>}
    </>
  );
}
