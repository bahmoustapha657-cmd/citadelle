import React, { useContext, useEffect, useMemo, useState } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C } from "../constants";
import { getActiveNoteForms, getEvaluationLabel, resolveCanonicalNoteType } from "../evaluation-forms";
import { GlobalStyles } from "../styles";
import { Badge, Btn, Card, Chargement, Input, LectureSeule, Modale, Selec, Stat, TD, THead, TR, Vide } from "./ui";

function PortailEnseignant({ utilisateur, deconnecter, annee, schoolInfo }) {
  const { moisAnnee, toast } = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;
  const noteForms = getActiveNoteForms(schoolInfo, utilisateur.section || "secondaire");
  const defaultNoteType = noteForms[0]?.value || "Devoir";

  const [tab, setTab] = useState("dashboard");
  const [periodeN, setPeriodeN] = useState(moisAnnee[0] || "");
  const [chargement, setChargement] = useState(true);
  const [portalData, setPortalData] = useState({
    section: utilisateur.section || "college",
    emplois: [],
    eleves: [],
    notes: [],
    enseignements: [],
    salaires: [],
  });
  const [modalNote, setModalNote] = useState(null);
  const [formNote, setFormNote] = useState({});
  const [enregistrement, setEnregistrement] = useState(false);

  const nomEns = utilisateur.enseignantNom || utilisateur.nom || "";
  const matiere = utilisateur.matiere || "";
  const emplois = portalData.emplois || [];
  const eleves = portalData.eleves || [];
  const notes = portalData.notes || [];
  const enseignements = portalData.enseignements || [];
  const salaires = portalData.salaires || [];

  const mesClasses = [...new Set(emplois.map((item) => item.classe).filter(Boolean))];
  const mesNotes = [...notes].sort((left, right) => Number(right.updatedAt || right.createdAt || 0) - Number(left.updatedAt || left.createdAt || 0));
  const mesEvenements = [...enseignements].sort((left, right) => Number(right.date || 0) - Number(left.date || 0));

  const formatEmploiHeure = (emploi) => {
    if (emploi.heure) {
      return emploi.heure;
    }
    if (emploi.heureDebut || emploi.heureFin) {
      return [emploi.heureDebut || "", emploi.heureFin || ""].filter(Boolean).join(" - ");
    }
    return "-";
  };

  const chargerPortail = async () => {
    setChargement(true);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch("/teacher-portal", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Chargement impossible.");
      }
      setPortalData({
        section: data.section || utilisateur.section || "college",
        emplois: Array.isArray(data.emplois) ? data.emplois : [],
        eleves: Array.isArray(data.eleves) ? data.eleves : [],
        notes: Array.isArray(data.notes) ? data.notes : [],
        enseignements: Array.isArray(data.enseignements) ? data.enseignements : [],
        salaires: Array.isArray(data.salaires) ? data.salaires : [],
      });
    } catch (error) {
      toast(error.message || "Erreur de chargement du portail enseignant.", "error");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerPortail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ouvrirCreationNote = () => {
    setFormNote({
      eleveId: "",
      type: defaultNoteType,
      periode: periodeN,
      note: "",
    });
    setModalNote("add");
  };

  const ouvrirEditionNote = (note) => {
    setFormNote({
      noteId: note._id,
      eleveId: note.eleveId || "",
      type: note.type || defaultNoteType,
      periode: note.periode || periodeN,
      note: note.note ?? "",
    });
    setModalNote("edit");
  };

  const enregistrerNote = async () => {
    if (!formNote.eleveId || formNote.note === "" || !formNote.periode) {
      toast("Eleve, periode et note requis.", "warning");
      return;
    }

    setEnregistrement(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/teacher-portal", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "save_note",
          noteId: formNote.noteId || "",
          eleveId: formNote.eleveId,
          type: resolveCanonicalNoteType(formNote.type || defaultNoteType, schoolInfo, utilisateur.section || "secondaire"),
          periode: formNote.periode,
          note: Number(formNote.note),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Enregistrement impossible.");
      }
      setModalNote(null);
      await chargerPortail();
      toast("Note enregistree.", "success");
    } catch (error) {
      toast(error.message || "Erreur d'enregistrement.", "error");
    } finally {
      setEnregistrement(false);
    }
  };

  const supprimerNote = async (noteId) => {
    if (!noteId || !window.confirm("Supprimer cette note ?")) {
      return;
    }

    setEnregistrement(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/teacher-portal", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "delete_note",
          noteId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Suppression impossible.");
      }
      await chargerPortail();
      toast("Note supprimee.", "success");
    } catch (error) {
      toast(error.message || "Erreur de suppression.", "error");
    } finally {
      setEnregistrement(false);
    }
  };

  const notesPeriode = useMemo(
    () => mesNotes.filter((item) => item.periode === periodeN),
    [mesNotes, periodeN],
  );

  const imprimerEdt = () => {
    const rows = emplois.map((emploi) => (
      `<tr><td>${emploi.jour || "-"}</td><td>${formatEmploiHeure(emploi)}</td><td>${emploi.classe || "-"}</td><td>${emploi.matiere || matiere || "-"}</td></tr>`
    )).join("");
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>EDT - ${nomEns}</title><style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}button{display:none}}body{font-family:Arial,sans-serif;padding:14mm 12mm;margin:0}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d0dce8;padding:8px 10px;font-size:12px}th{background:#0A1628;color:#fff}</style></head><body><h2 style="color:#0A1628">Emploi du temps - ${nomEns}</h2><p style="color:#555">${matiere} - ${schoolInfo.nom} - ${annee}</p><table><tr><th>Jour</th><th>Heure</th><th>Classe</th><th>Matiere</th></tr>${rows}</table><br/><button onclick="window.print()">Imprimer</button></body></html>`);
    w.document.close();
  };

  const imprimerPaies = () => {
    const lignes = salaires.map((salaire) => {
      const heuresExec = Number(salaire.vhPrevu || 0) + Number(salaire.cinqSem || 0) - Number(salaire.nonExecute || 0);
      const baseSec = (salaire.montantBrut !== undefined && salaire.montantBrut !== null && Number.isFinite(Number(salaire.montantBrut)))
        ? Number(salaire.montantBrut)
        : heuresExec * Number(salaire.primeHoraire || 0);
      const net = salaire.section === "Secondaire"
        ? (baseSec - Number(salaire.bon || 0) + Number(salaire.revision || 0))
        : (Number(salaire.montantForfait || 0) - Number(salaire.bon || 0) + Number(salaire.revision || 0));
      const detailSec = salaire.primesVariables
        ? `${heuresExec} h - primes variables (voir details ecole)`
        : `${heuresExec} h x ${(salaire.primeHoraire || 0).toLocaleString("fr-FR")} GNF`;
      return `<tr><td>${salaire.mois}</td><td>${salaire.section}</td><td>${salaire.section === "Secondaire" ? detailSec : `Forfait ${Number(salaire.montantForfait || 0).toLocaleString("fr-FR")} GNF`}</td><td>${Number(salaire.bon || 0) > 0 ? `-${Number(salaire.bon).toLocaleString("fr-FR")}` : "-"}</td><td>${Number(salaire.revision || 0) > 0 ? `+${Number(salaire.revision).toLocaleString("fr-FR")}` : "-"}</td><td style="font-weight:900;color:#0A1628">${net.toLocaleString("fr-FR")} GNF</td></tr>`;
    }).join("");
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head><title>Paies - ${nomEns}</title><style>@page{size:A4 portrait;margin:0}@media print{html,body{margin:0}button{display:none}}body{font-family:Arial,sans-serif;padding:14mm 12mm;font-size:13px;margin:0}h2{color:#0A1628}table{width:100%;border-collapse:collapse;margin-top:16px}th{background:#0A1628;color:#fff;padding:8px 10px}td{padding:8px 10px;border-bottom:1px solid #e5e7eb}</style></head><body><h2>${schoolInfo.nom || "Ecole"} - Fiches de paie</h2><p>${nomEns} - ${matiere || "Enseignant"} - Annee ${annee}</p><table><tr><th>Mois</th><th>Section</th><th>Detail</th><th>Bon</th><th>Revision</th><th>Net a payer</th></tr>${lignes}</table><br/><button onclick="window.print()">Imprimer</button></body></html>`);
    w.document.close();
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <GlobalStyles />
      <div style={{ background: `linear-gradient(135deg,${c1},${c1}ee)`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
        {schoolInfo.logo && <img src={schoolInfo.logo} alt="logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ color: c2, fontWeight: 900, fontSize: 15 }}>{schoolInfo.nom || "Ecole"}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Portail enseignant - {annee}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{nomEns}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Badge color="purple">{matiere || "Enseignant"}</Badge>
            <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Deconnexion</button>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {[
          { id: "dashboard", label: "Dashboard" },
          { id: "edt", label: "Mon EDT" },
          { id: "notes", label: "Saisie notes" },
          { id: "eleves", label: "Mes eleves" },
          { id: "absences", label: "Absences / engagements" },
          { id: "salaire", label: "Paie" },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              padding: "13px 18px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: tab === item.id ? c1 : "#64748b",
              borderBottom: tab === item.id ? `3px solid ${c1}` : "3px solid transparent",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>
        {chargement ? (
          <Chargement rows={6} />
        ) : (
          <>
            {tab === "dashboard" && (
              <>
                <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: c1 }}>Bonjour, {nomEns.split(" ")[0] || nomEns}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
                  <Stat label="Mes classes" value={mesClasses.length} sub={mesClasses.join(", ") || "-"} bg="#f0f7ff" />
                  <Stat label="Mes eleves" value={eleves.length} sub="classes attribuees" bg="#f0fdf4" />
                  <Stat label="Notes saisies" value={mesNotes.length} sub={matiere || "Toutes"} bg="#fefce8" />
                  <Stat label="Creneaux / semaine" value={emplois.length} sub="emploi du temps" bg="#fdf4ff" />
                  <Stat label="Evenements" value={mesEvenements.length} sub="historique enseignant" bg="#fff1f2" />
                </div>

                {emplois.length > 0 && (
                  <Card style={{ marginBottom: 20 }}>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong style={{ fontSize: 13, color: c1 }}>Mon emploi du temps</strong>
                    </div>
                    <div style={{ padding: "12px 18px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {emplois.map((emploi, index) => (
                        <div key={index} style={{ background: `${c1}11`, borderLeft: `3px solid ${c1}`, borderRadius: "0 8px 8px 0", padding: "8px 12px", minWidth: 130 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: c1 }}>{emploi.jour} - {formatEmploiHeure(emploi)}</div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginTop: 2 }}>{emploi.classe}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{emploi.matiere || matiere}</div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {mesNotes.length > 0 && (
                  <Card>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong style={{ fontSize: 13, color: c1 }}>Dernieres notes saisies</strong>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <THead cols={["Eleve", "Matiere", "Type", "Periode", "Note"]} />
                        <tbody>
                          {mesNotes.slice(0, 10).map((note) => (
                            <TR key={note._id}>
                              <TD bold>{note.eleveNom}</TD>
                              <TD>{note.matiere}</TD>
                              <TD><Badge color="blue">{getEvaluationLabel(note.type, schoolInfo, { section: utilisateur.section || "secondaire" })}</Badge></TD>
                              <TD>{note.periode}</TD>
                              <TD center><strong style={{ color: Number(note.note) >= 10 ? C.greenDk : "#b91c1c" }}>{note.note}/20</strong></TD>
                            </TR>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </>
            )}

            {tab === "edt" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1 }}>Mon emploi du temps</h2>
                  {emplois.length > 0 && <Btn sm v="ghost" onClick={imprimerEdt}>Imprimer EDT</Btn>}
                </div>
                {emplois.length === 0 ? (
                  <Vide icone="EDT" msg="Aucun creneau dans votre emploi du temps" />
                ) : (
                  <Card>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                        <THead cols={["Jour", "Heure", "Classe", "Matiere"]} />
                        <tbody>
                          {emplois.map((emploi, index) => (
                            <TR key={emploi._id || index}>
                              <TD bold>{emploi.jour || "-"}</TD>
                              <TD>{formatEmploiHeure(emploi)}</TD>
                              <TD><Badge color="blue">{emploi.classe || "-"}</Badge></TD>
                              <TD>{emploi.matiere || matiere || "-"}</TD>
                            </TR>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}
              </>
            )}

            {tab === "notes" && (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1, flex: 1 }}>Saisie des notes - {matiere || "Matiere"}</h2>
                  <select value={periodeN} onChange={(event) => setPeriodeN(event.target.value)} style={{ border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "#fff" }}>
                    {moisAnnee.map((mois) => <option key={mois}>{mois}</option>)}
                  </select>
                  <Btn onClick={ouvrirCreationNote}>Nouvelle note</Btn>
                </div>

                {notesPeriode.length === 0 ? (
                  <Vide icone="Notes" msg={`Aucune note pour ${periodeN}`} />
                ) : (
                  <Card>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <THead cols={["Eleve", "Type", "Note /20", "Actions"]} />
                      <tbody>
                        {notesPeriode.map((note) => (
                          <TR key={note._id}>
                            <TD bold>{note.eleveNom}</TD>
                            <TD><Badge color="blue">{getEvaluationLabel(note.type, schoolInfo, { section: utilisateur.section || "secondaire" })}</Badge></TD>
                            <TD center><strong style={{ fontSize: 14, color: Number(note.note) >= 10 ? C.greenDk : "#b91c1c" }}>{note.note}</strong></TD>
                            <TD center>
                              <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
                                <Btn sm v="ghost" onClick={() => ouvrirEditionNote(note)}>Modifier</Btn>
                                <Btn sm v="danger" onClick={() => supprimerNote(note._id)} disabled={enregistrement}>Supprimer</Btn>
                              </div>
                            </TD>
                          </TR>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}

                {modalNote && (
                  <Modale titre={modalNote === "add" ? "Nouvelle note" : "Modifier la note"} fermer={() => setModalNote(null)}>
                    <Selec
                      label="Eleve"
                      value={formNote.eleveId || ""}
                      onChange={(event) => setFormNote((current) => ({ ...current, eleveId: event.target.value }))}
                    >
                      <option value="">- Choisir un eleve -</option>
                      {eleves.map((eleveItem) => (
                        <option key={eleveItem._id} value={eleveItem._id}>
                          {eleveItem.nom} {eleveItem.prenom} ({eleveItem.classe})
                        </option>
                      ))}
                    </Selec>
                    <div style={{ height: 10 }} />
                    <Selec
                      label="Type"
                      value={formNote.type || defaultNoteType}
                      onChange={(event) => setFormNote((current) => ({ ...current, type: event.target.value }))}
                    >
                      {noteForms.map((item) => <option key={item.id} value={item.value}>{item.label}</option>)}
                    </Selec>
                    <div style={{ height: 10 }} />
                    <Selec
                      label="Periode"
                      value={formNote.periode || periodeN}
                      onChange={(event) => setFormNote((current) => ({ ...current, periode: event.target.value }))}
                    >
                      {moisAnnee.map((mois) => <option key={mois}>{mois}</option>)}
                    </Selec>
                    <div style={{ height: 10 }} />
                    <Input
                      label="Note /20"
                      type="number"
                      value={formNote.note ?? ""}
                      onChange={(event) => setFormNote((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Ex : 14"
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                      <Btn v="ghost" onClick={() => setModalNote(null)}>Annuler</Btn>
                      <Btn onClick={enregistrerNote} disabled={enregistrement}>{enregistrement ? "Enregistrement..." : "Enregistrer"}</Btn>
                    </div>
                  </Modale>
                )}
              </>
            )}

            {tab === "eleves" && (
              <>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Mes eleves ({eleves.length})</h2>
                {mesClasses.length === 0 ? (
                  <Vide icone="Eleves" msg="Aucune classe assignee dans l'emploi du temps" />
                ) : (
                  <>
                    <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                      {mesClasses.map((classe) => (
                        <Badge key={classe} color="blue">{classe} - {eleves.filter((eleveItem) => eleveItem.classe === classe).length} eleve(s)</Badge>
                      ))}
                    </div>
                    <Card>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <THead cols={["Matricule", "Nom et prenom", "Classe", "Sexe", "Statut"]} />
                        <tbody>
                          {eleves.map((eleveItem) => (
                            <TR key={eleveItem._id}>
                              <TD><span style={{ fontFamily: "monospace", fontSize: 11, background: "#e0ebf8", padding: "2px 5px", borderRadius: 4, color: c1, fontWeight: 700 }}>{eleveItem.matricule}</span></TD>
                              <TD bold>{eleveItem.nom} {eleveItem.prenom}</TD>
                              <TD><Badge color="blue">{eleveItem.classe}</Badge></TD>
                              <TD><Badge color={eleveItem.sexe === "F" ? "vert" : "blue"}>{eleveItem.sexe}</Badge></TD>
                              <TD><Badge color={eleveItem.statut === "Actif" ? "vert" : "gray"}>{eleveItem.statut || "Actif"}</Badge></TD>
                            </TR>
                          ))}
                        </tbody>
                      </table>
                    </Card>
                  </>
                )}
              </>
            )}

            {tab === "absences" && (
              <>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Absences et engagements</h2>
                {mesEvenements.length === 0 ? (
                  <Vide icone="Evenements" msg="Aucun evenement enregistre" />
                ) : (
                  <Card>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <THead cols={["Date", "Classe", "Matiere", "Statut", "Motif"]} />
                      <tbody>
                        {mesEvenements.map((item) => (
                          <TR key={item._id}>
                            <TD>{item.date || "-"}</TD>
                            <TD><Badge color="blue">{item.classe || "-"}</Badge></TD>
                            <TD>{item.matiere || matiere || "-"}</TD>
                            <TD><Badge color={item.statut === "Absent" ? "red" : item.statut === "Non effectue" ? "amber" : "vert"}>{item.statut || "-"}</Badge></TD>
                            <TD>{item.motif || "-"}</TD>
                          </TR>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </>
            )}

            {tab === "salaire" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: c1 }}>Ma fiche de paie</h2>
                  {salaires.length > 0 && <Btn sm v="ghost" onClick={imprimerPaies}>Imprimer fiches</Btn>}
                </div>
                <LectureSeule />
                {salaires.length === 0 ? (
                  <Vide icone="Paie" msg="Aucune fiche de paie disponible" />
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 12 }}>
                    {salaires.map((salaire) => {
                      const heuresExec = Number(salaire.vhPrevu || 0) + Number(salaire.cinqSem || 0) - Number(salaire.nonExecute || 0);
                      const baseSec = (salaire.montantBrut !== undefined && salaire.montantBrut !== null && Number.isFinite(Number(salaire.montantBrut)))
                        ? Number(salaire.montantBrut)
                        : heuresExec * Number(salaire.primeHoraire || 0);
                      const net = salaire.section === "Secondaire"
                        ? (baseSec - Number(salaire.bon || 0) + Number(salaire.revision || 0))
                        : (Number(salaire.montantForfait || 0) - Number(salaire.bon || 0) + Number(salaire.revision || 0));
                      return (
                        <Card key={salaire._id} style={{ padding: 0 }}>
                          <div style={{ background: `linear-gradient(135deg,${c1},${c1}cc)`, padding: "12px 16px", borderRadius: "14px 14px 0 0" }}>
                            <div style={{ color: c2, fontWeight: 900, fontSize: 13 }}>{salaire.mois}</div>
                            <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Section {salaire.section}</div>
                          </div>
                          <div style={{ padding: "14px 16px" }}>
                            {salaire.section === "Secondaire" ? (
                              <>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
                                  <span style={{ color: "#64748b" }}>V.H. execute</span>
                                  <strong>{Number(salaire.vhPrevu || 0) + Number(salaire.cinqSem || 0) - Number(salaire.nonExecute || 0)} h</strong>
                                </div>
                                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                  <span style={{ color: "#64748b" }}>Prime horaire</span>
                                  <strong>{salaire.primesVariables ? "Variable" : `${Number(salaire.primeHoraire || 0).toLocaleString("fr-FR")} GNF`}</strong>
                                </div>
                                {salaire.primesVariables && (
                                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                                    <span style={{ color: "#64748b" }}>Montant brut</span>
                                    <strong>{Number(salaire.montantBrut || 0).toLocaleString("fr-FR")} GNF</strong>
                                  </div>
                                )}
                              </>
                            ) : (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, paddingBottom: 6, borderBottom: "1px solid #f1f5f9" }}>
                                <span style={{ color: "#64748b" }}>Forfait</span>
                                <strong>{Number(salaire.montantForfait || 0).toLocaleString("fr-FR")} GNF</strong>
                              </div>
                            )}
                            {Number(salaire.bon || 0) > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: "#b91c1c" }}>
                                <span>Bon deduit</span>
                                <strong>-{Number(salaire.bon).toLocaleString("fr-FR")} GNF</strong>
                              </div>
                            )}
                            {Number(salaire.revision || 0) > 0 && (
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6, color: C.greenDk }}>
                                <span>Revision</span>
                                <strong>+{Number(salaire.revision).toLocaleString("fr-FR")} GNF</strong>
                              </div>
                            )}
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: `${c1}0d`, borderRadius: 8, marginTop: 8 }}>
                              <span style={{ fontWeight: 700, fontSize: 13, color: c1 }}>NET A PAYER</span>
                              <strong style={{ fontSize: 15, color: c1 }}>{net.toLocaleString("fr-FR")} GNF</strong>
                            </div>
                            {salaire.observation && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{salaire.observation}</p>}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { PortailEnseignant };
