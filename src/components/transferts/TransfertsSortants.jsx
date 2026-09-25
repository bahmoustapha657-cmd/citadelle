import { C, fmt } from "../../constants";
import { lireDate } from "../../depart-utils";
import { imprimerCertificatRadiation, imprimerOrdreMutation } from "../../reports";
import { Badge, Btn, Card, Modale, TD, THead, TR, Vide } from "../ui";
import { etatTransfert, finValidite, transfertDeLEleve, VALIDITE_TOKEN_JOURS } from "./dossier-transfert";

// Sous-onglet "Sortants" : tableau des élèves transférés (documents officiels +
// token EduGest) et la modale affichant le token généré. Les tokens émis sont
// relus depuis la base : un token en cours reste affiché, on n'en génère pas
// un second ; un token expiré se régénère.
export function TransfertsSortants({ h }) {
  const { schoolInfo, toast, canEdit, partis, situation, transfertsSortants, genererToken, loading, modalSortant, setModalSortant } = h;
  const copier = (token) => { navigator.clipboard?.writeText(token); toast("Token copié", "success"); };
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
                const s = situation(e);
                const transfert = transfertDeLEleve(transfertsSortants, e._id);
                const etat = etatTransfert(transfert);
                const date = lireDate(e.dateDepart);
                return <TR key={e._id}>
                  <TD><span style={{ fontSize: 11, fontFamily: "monospace", background: "#e0ebf8", padding: "2px 5px", borderRadius: 4, color: C.blue, fontWeight: 700 }}>{e.matricule}</span></TD>
                  <TD bold>{e.nom} {e.prenom}</TD>
                  <TD><Badge color="blue">{e.classe}</Badge></TD>
                  <TD>{date ? date.toLocaleDateString("fr-FR") : <Badge color="amber">Date manquante</Badge>}</TD>
                  <TD><span style={{ fontSize: 11, color: "#6b7280" }}>{e.destinationDepart || "—"}</span></TD>
                  <TD><span title={`Année ${s.annee}`} style={{ fontWeight: 700, color: s.solde > 0 ? "#b91c1c" : "#15803d" }}>{s.solde > 0 ? fmt(s.solde) : "Apuré"}</span></TD>
                  <TD>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <Btn sm v="ghost" onClick={() => imprimerOrdreMutation(e, schoolInfo, e.destinationDepart || "", s.annee, s)}>📄 Mutation</Btn>
                      <Btn sm v="ghost" onClick={() => imprimerCertificatRadiation(e, schoolInfo, s.annee, s.solde, s)}>📄 Radiation</Btn>
                    </div>
                  </TD>
                  <TD>
                    {etat === "accepte" && <Badge color="green">✓ Accueilli par l'école de destination</Badge>}
                    {etat === "en_attente" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span title={transfert.token} style={{ fontFamily: "monospace", fontWeight: 900, color: C.blue, fontSize: 12 }}>
                          {transfert.token.slice(0, 8)}…
                        </span>
                        <Btn sm v="ghost" onClick={() => copier(transfert.token)}>📋 Copier</Btn>
                        {finValidite(transfert) && <span style={{ fontSize: 10, color: "#64748b" }}>
                          valable jusqu'au {finValidite(transfert).toLocaleDateString("fr-FR")}
                        </span>}
                      </div>
                    )}
                    {(etat === null || etat === "expire") && canEdit && (
                      <Btn sm v="blue" onClick={() => genererToken(e, e.destinationDepart || "")} disabled={loading}>
                        🔑 {etat === "expire" ? "Régénérer (expiré)" : "Générer"}
                      </Btn>
                    )}
                  </TD>
                </TR>;
              })}</tbody>
            </table></div>
          </Card>
      }

      {modalSortant?.token && <Modale titre="🔑 Token de transfert généré" fermer={() => setModalSortant(null)}>
        <p style={{ fontSize: 13, marginBottom: 16 }}>
          Remettez ce code à <strong>{modalSortant.nom} {modalSortant.prenom}</strong> ou à son école d'accueil
          (par exemple par WhatsApp) : elle le colle dans Transferts → Entrants.
        </p>
        <div style={{ background: "#f0f9ff", border: "2px solid #38bdf8", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, fontFamily: "monospace", color: C.blue, letterSpacing: 1, wordBreak: "break-all" }}>{modalSortant.token}</div>
          <div style={{ fontSize: 11, color: "#0369a1", marginTop: 6 }}>Valable {VALIDITE_TOKEN_JOURS} jours · Usage unique</div>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Btn v="ghost" onClick={() => setModalSortant(null)}>Fermer</Btn>
          <Btn v="blue" onClick={() => copier(modalSortant.token)}>📋 Copier</Btn>
        </div>
      </Modale>}
    </>
  );
}
