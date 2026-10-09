import { useCallback, useEffect, useState } from "react";
import { fmt } from "../../constants";
import { Badge, Btn, Card, Modale, TD, THead, TR } from "../ui";
import { listerPaiementsEnLigne, rapprocherPaiements, regulariserPaiement } from "../../backend/paiement-en-ligne";

const STATUTS = {
  impute: { label: "Encaissé", color: "green" },
  en_attente: { label: "En attente", color: "blue" },
  echoue: { label: "Non abouti", color: "gray" },
  a_verifier: { label: "À vérifier", color: "amber" },
  regularise: { label: "Régularisé", color: "gray" },
};

const MOTIFS = {
  annee: "l'année scolaire a changé entre-temps",
  depasse: "déjà encaissé en caisse entre-temps",
  cible: "ce qui était payé n'est plus dû",
  montant: "montant reçu différent du montant demandé",
  conflit_repete: "fiche en cours de modification",
  colonnes: "écriture non prise en charge",
  eleve: "fiche de l'élève supprimée",
};

const dateCourte = (iso) => (iso ? new Date(iso).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

// ══════════════════════════════════════════════════════════════
//  Comptabilité — paiements reçus en ligne (Mobile Money)
// ══════════════════════════════════════════════════════════════
// Les paiements « Encaissé » sont DÉJÀ sur la fiche de l'élève et au journal
// de caisse (imputation automatique). « À vérifier » : l'argent est reçu
// sur le compte de l'école mais n'a pas pu s'appliquer tel quel — au
// comptable de l'affecter (Mensualités → Encaisser) ou de le rembourser,
// puis de le marquer « Régularisé » avec une note.
// À chaque ouverture (et « ↻ Actualiser »), les paiements restés « en
// attente » sont redemandés à l'opérateur : une notification perdue ne
// laisse pas un paiement reçu sans écriture.
export function PaiementsEnLigneTab({ peutEcrire = false }) {
  const [paiements, setPaiements] = useState(null);
  const [erreur, setErreur] = useState("");
  const [aRegulariser, setARegulariser] = useState(null);
  // « ↻ Actualiser » incrémente ce compteur, qui relance le chargement.
  const [tour, setTour] = useState(0);
  const charger = useCallback(() => setTour((n) => n + 1), []);
  useEffect(() => {
    let actif = true;
    // Rapprochement d'abord (sans bloquer la liste s'il échoue).
    const rapprocher = peutEcrire ? rapprocherPaiements().catch(() => null) : Promise.resolve();
    rapprocher.then(() => listerPaiementsEnLigne())
      .then((liste) => { if (actif) { setPaiements(liste); setErreur(""); } })
      .catch((e) => { if (actif) setErreur(e.message); });
    return () => { actif = false; };
  }, [tour, peutEcrire]);

  const aVerifier = (paiements || []).filter((p) => p.statut === "a_verifier");
  const encaisses = (paiements || []).filter((p) => p.statut === "impute");
  const totalEncaisse = encaisses.reduce((s, p) => s + Number(p.montant), 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
          Payés par les parents en Mobile Money : enregistrés automatiquement sur la fiche et au journal de caisse.
          {encaisses.length > 0 && <> <strong>{encaisses.length}</strong> paiement(s), <strong>{fmt(totalEncaisse)}</strong> de scolarité.</>}
        </p>
        <Btn sm v="ghost" onClick={charger}>↻ Actualiser</Btn>
      </div>

      {aVerifier.length > 0 && (
        <div style={{ padding: "10px 14px", marginBottom: 14, borderRadius: 10, background: "#fef3c7", color: "#92400e", fontSize: 13 }}>
          ⚠️ <strong>{aVerifier.length} paiement(s) à vérifier</strong> : l'argent est reçu mais n'a pas pu être enregistré automatiquement.
          Affectez-le depuis Mensualités → Encaisser, ou remboursez le parent, puis cliquez « Régulariser ».
        </div>
      )}

      {erreur && <p style={{ color: "#b91c1c", fontSize: 13 }}>{erreur}</p>}
      {paiements && !paiements.length && (
        <p style={{ padding: "40px 20px", textAlign: "center", fontSize: 14, color: "#64748b", border: "2px dashed #e2e8f0", borderRadius: 14 }}>
          💳 Aucun paiement en ligne pour le moment.
        </p>
      )}
      {paiements?.length > 0 && (
        <Card>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <THead cols={["Date", "Élève", "Objet", "Montant", "Frais", "Statut", "Référence"]} />
              <tbody>
                {paiements.map((p) => {
                  const s = STATUTS[p.statut] || STATUTS.en_attente;
                  const motif = p.detail?.motif;
                  return (
                    <TR key={p.id} bg={p.statut === "a_verifier" ? "#fffbeb" : undefined}>
                      <TD>{dateCourte(p.created_at)}</TD>
                      <TD bold>{`${p.eleves?.nom || ""} ${p.eleves?.prenom || ""}`.trim() || p.eleve_nom || "—"}<br />
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>{p.eleves?.classe || ""}</span>
                      </TD>
                      <TD>{p.cible?.label || "—"}
                        {p.statut === "impute" && Array.isArray(p.detail?.lignes) && (
                          <span style={{ display: "block", fontSize: 11, color: "#64748b" }}>
                            {p.detail.lignes.map((l) => l.libelle).join(", ")}
                          </span>
                        )}
                      </TD>
                      <TD bold>{fmt(Number(p.montant))}</TD>
                      <TD>{fmt(Number(p.frais))}</TD>
                      <TD>
                        <Badge color={s.color}>{s.label}</Badge>
                        {p.detail?.operateur && <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 3 }}>{p.detail.operateur}</span>}
                        {p.statut === "a_verifier" && motif && <span style={{ display: "block", fontSize: 11, color: "#92400e", marginTop: 3 }}>{MOTIFS[motif] || motif}</span>}
                        {p.statut === "a_verifier" && peutEcrire && (
                          <span style={{ display: "block", marginTop: 6 }}>
                            <Btn sm v="ghost" onClick={() => setARegulariser(p)}>Régulariser</Btn>
                          </span>
                        )}
                        {p.statut === "regularise" && p.detail?.regularisation && (
                          <span style={{ display: "block", fontSize: 11, color: "#64748b", marginTop: 3 }}>
                            {p.detail.regularisation.note}
                            {p.detail.regularisation.nom ? ` — ${p.detail.regularisation.nom}` : ""}, {dateCourte(p.detail.regularisation.le)}
                          </span>
                        )}
                      </TD>
                      <TD><span style={{ fontFamily: "monospace", fontSize: 11 }}>{p.reference}</span></TD>
                    </TR>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {aRegulariser && (
        <RegulariserModale paiement={aRegulariser} fermer={() => setARegulariser(null)}
          termine={() => { setARegulariser(null); charger(); }} />
      )}
    </div>
  );
}

// Note obligatoire : ce que le comptable a fait de l'argent (gardée avec le
// paiement, visible de tous les comptables).
function RegulariserModale({ paiement, fermer, termine }) {
  const [note, setNote] = useState("");
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);
  const valider = async () => {
    setEnCours(true); setErreur("");
    try {
      await regulariserPaiement(paiement.reference, note);
      termine();
    } catch (e) {
      setErreur(e.message);
      setEnCours(false);
    }
  };
  const nom = `${paiement.eleves?.nom || ""} ${paiement.eleves?.prenom || ""}`.trim() || paiement.eleve_nom || "";
  return (
    <Modale titre="Régulariser un paiement en ligne" fermer={fermer}>
      <p style={{ margin: "0 0 10px", fontSize: 13 }}>
        {nom} · <strong>{fmt(Number(paiement.montant))}</strong> · réf. <span style={{ fontFamily: "monospace" }}>{paiement.reference}</span>
      </p>
      <label htmlFor="note-regularisation" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 4 }}>
        Qu'avez-vous fait de ce paiement ?
      </label>
      <textarea id="note-regularisation" rows={3} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="Ex. : affecté au mois d'octobre en caisse ; remboursé au parent le 12/10"
        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13 }} />
      {erreur && <p style={{ margin: "8px 0 0", fontSize: 13, color: "#b91c1c" }}>{erreur}</p>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
        <Btn v="ghost" onClick={fermer}>Annuler</Btn>
        <Btn onClick={valider} disabled={enCours || note.trim().length < 3}>{enCours ? "Enregistrement…" : "Marquer régularisé"}</Btn>
      </div>
    </Modale>
  );
}
