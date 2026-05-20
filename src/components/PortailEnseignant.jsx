import React, { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SchoolContext } from "../contexts/SchoolContext";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C } from "../constants";
import { getPeriodesForSection } from "../period-utils";
import { getActiveNoteForms, getEvaluationLabel } from "../evaluation-forms";
import { GlobalStyles } from "../styles";
import { Badge, Btn, Card, Chargement, Input, LectureSeule, Modale, Selec, Stat, TD, THead, TR, Vide } from "./ui";
import { imprimerEdtEnseignant, imprimerPaiesEnseignant } from "../reports";
import {
  construireGrille as construireGrilleHelper,
  enregistrerGrille as enregistrerGrilleAction,
  enregistrerNote as enregistrerNoteAction,
  supprimerNote as supprimerNoteAction,
} from "./portail-enseignant/notes-actions";
import {
  enregistrerIncident as enregistrerIncidentAction,
  supprimerIncident as supprimerIncidentAction,
} from "./portail-enseignant/incidents-actions";
import { NotesTab } from "./portail-enseignant/NotesTab";
import { AbsencesTab } from "./portail-enseignant/AbsencesTab";
import { SalaireTab } from "./portail-enseignant/SalaireTab";

function PortailEnseignant({ utilisateur, deconnecter, annee, schoolInfo }) {
  const { t } = useTranslation();
  const { moisAnnee, toast, envoyerPush } = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;
  const noteForms = getActiveNoteForms(schoolInfo, utilisateur.section || "secondaire");
  const defaultNoteType = noteForms[0]?.value || "Devoir";
  // Périodicité selon la section enseignée par le prof (primaire = trimestre, secondaire = trimestre ou semestre selon le DG).
  const sectionPeriode = (utilisateur.section === "primaire") ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);

  const [tab, setTab] = useState("dashboard");
  const [periodeN, setPeriodeN] = useState(periodes[0] || "");
  const [chargement, setChargement] = useState(true);
  const [portalData, setPortalData] = useState({
    section: utilisateur.section || "college",
    emplois: [],
    eleves: [],
    notes: [],
    enseignements: [],
    salaires: [],
    incidents: [],
  });
  const [modalNote, setModalNote] = useState(null);
  const [formNote, setFormNote] = useState({});
  const [gridForm, setGridForm] = useState({ classe: "", type: "", periode: "", notes: {} });
  const [gridProgress, setGridProgress] = useState({ done: 0, total: 0 });
  const [modalIncident, setModalIncident] = useState(null);
  const [formIncident, setFormIncident] = useState({});
  const [enregistrement, setEnregistrement] = useState(false);

  const nomEns = utilisateur.enseignantNom || utilisateur.nom || "";
  const matiere = utilisateur.matiere || "";
  const emplois = portalData.emplois || [];
  const eleves = portalData.eleves || [];
  const notes = portalData.notes || [];
  const enseignements = portalData.enseignements || [];
  const salaires = portalData.salaires || [];
  const incidents = portalData.incidents || [];
  const enseignantId = utilisateur.enseignantId || null;

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
        incidents: Array.isArray(data.incidents) ? data.incidents : [],
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

  // Wrapper : injecte eleves/notes/schoolInfo/utilisateur au helper.
  const construireGrille = (classe, type, periode) => construireGrilleHelper({
    classe, type, periode,
    eleves: portalData.eleves || [],
    mesNotes, schoolInfo, utilisateur,
  });

  const ouvrirGrille = () => {
    const classe = mesClasses[0] || "";
    const type = defaultNoteType;
    const periode = periodeN;
    setGridForm({
      classe,
      type,
      periode,
      notes: classe ? construireGrille(classe, type, periode) : {},
    });
    setGridProgress({ done: 0, total: 0 });
    setModalNote("grid");
  };

  const majGrid = (patch) => {
    setGridForm((current) => {
      const next = { ...current, ...patch };
      // Si on change classe/type/période, on reconstruit le tableau
      if (patch.classe !== undefined || patch.type !== undefined || patch.periode !== undefined) {
        next.notes = next.classe ? construireGrille(next.classe, next.type, next.periode) : {};
      }
      return next;
    });
  };

  const enregistrerGrille = () => enregistrerGrilleAction({
    gridForm, mesNotes, schoolInfo, utilisateur,
    setEnregistrement, setGridProgress, setModalNote, chargerPortail, toast,
  });

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

  const enregistrerNote = () => enregistrerNoteAction({
    formNote, defaultNoteType, schoolInfo, utilisateur,
    setEnregistrement, setModalNote, chargerPortail, toast,
  });
  const supprimerNote = (noteId) => supprimerNoteAction(noteId, {
    setEnregistrement, chargerPortail, toast,
  });

  const ouvrirSignalementEleve = (eleve) => {
    setFormIncident({
      eleveId: eleve._id,
      eleveNom: `${eleve.nom} ${eleve.prenom}`,
      classe: eleve.classe || "",
      type: "Absence",
      date: new Date().toISOString().slice(0, 10),
      justifie: "Non",
      motif: "",
    });
    setModalIncident("add");
  };

  const ouvrirEditionIncident = (inc) => {
    setFormIncident({
      incidentId: inc._id,
      eleveId: inc.eleveId,
      eleveNom: inc.eleveNom,
      classe: inc.classe || "",
      type: inc.type || "Absence",
      date: inc.date || new Date().toISOString().slice(0, 10),
      justifie: inc.justifie || "Non",
      motif: inc.motif || "",
    });
    setModalIncident("edit");
  };

  const enregistrerIncident = () => enregistrerIncidentAction({
    formIncident, envoyerPush, setEnregistrement, setModalIncident, chargerPortail, toast,
  });
  const supprimerIncident = (incidentId) => supprimerIncidentAction(incidentId, {
    setEnregistrement, chargerPortail, toast,
  });

  const notesPeriode = useMemo(
    () => mesNotes.filter((item) => item.periode === periodeN),
    [mesNotes, periodeN],
  );

  const imprimerEdt = () => imprimerEdtEnseignant({ emplois, nomEns, matiere, schoolInfo, annee });
  const imprimerPaies = () => imprimerPaiesEnseignant({ salaires, nomEns, matiere, schoolInfo, annee });

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
            <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>{t("auth.logout")}</button>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {[
          { id: "dashboard", label: t("teacher.tabs.overview") },
          { id: "edt", label: t("teacher.tabs.schedule") },
          { id: "notes", label: t("teacher.tabs.grades") },
          { id: "eleves", label: t("teacher.tabs.students") },
          { id: "absences", label: t("dashboard.absences") },
          { id: "salaire", label: t("accounting.tabs.salaries") },
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
                <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: c1 }}>{t("teacher.welcome")}, {nomEns.split(" ")[0] || nomEns}</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 24 }}>
                  <Stat label={t("teacher.myClasses")} value={mesClasses.length} sub={mesClasses.join(", ") || "-"} bg="#f0f7ff" />
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
              <NotesTab
                c1={c1} matiere={matiere} schoolInfo={schoolInfo} utilisateur={utilisateur}
                periodeN={periodeN} setPeriodeN={setPeriodeN} periodes={periodes}
                mesClasses={mesClasses} notesPeriode={notesPeriode}
                noteForms={noteForms} defaultNoteType={defaultNoteType}
                eleves={eleves} portalData={portalData}
                modalNote={modalNote} setModalNote={setModalNote}
                formNote={formNote} setFormNote={setFormNote}
                gridForm={gridForm} setGridForm={setGridForm}
                gridProgress={gridProgress}
                enregistrement={enregistrement}
                ouvrirCreationNote={ouvrirCreationNote}
                ouvrirGrille={ouvrirGrille}
                ouvrirEditionNote={ouvrirEditionNote}
                supprimerNote={supprimerNote}
                enregistrerNote={enregistrerNote}
                enregistrerGrille={enregistrerGrille}
                majGrid={majGrid}
              />
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
                        <THead cols={["Matricule", "Nom et prenom", "Classe", "Sexe", "Statut", "Action"]} />
                        <tbody>
                          {eleves.map((eleveItem) => (
                            <TR key={eleveItem._id}>
                              <TD><span style={{ fontFamily: "monospace", fontSize: 11, background: "#e0ebf8", padding: "2px 5px", borderRadius: 4, color: c1, fontWeight: 700 }}>{eleveItem.matricule}</span></TD>
                              <TD bold>{eleveItem.nom} {eleveItem.prenom}</TD>
                              <TD><Badge color="blue">{eleveItem.classe}</Badge></TD>
                              <TD><Badge color={eleveItem.sexe === "F" ? "vert" : "blue"}>{eleveItem.sexe}</Badge></TD>
                              <TD><Badge color={eleveItem.statut === "Actif" ? "vert" : "gray"}>{eleveItem.statut || "Actif"}</Badge></TD>
                              <TD>
                                <Btn sm v="amber" onClick={() => ouvrirSignalementEleve(eleveItem)}>⚠️ Signaler</Btn>
                              </TD>
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
              <AbsencesTab
                c1={c1} matiere={matiere}
                incidents={incidents} mesEvenements={mesEvenements}
                enseignantId={enseignantId}
                ouvrirEditionIncident={ouvrirEditionIncident}
                supprimerIncident={supprimerIncident}
              />
            )}

            {tab === "salaire" && (
              <SalaireTab c1={c1} c2={c2} salaires={salaires} imprimerPaies={imprimerPaies}/>
            )}
          </>
        )}

        {modalIncident && (
          <Modale titre={modalIncident === "edit" ? "Modifier le signalement" : `Signaler — ${formIncident.eleveNom || ""}`} fermer={() => setModalIncident(null)}>
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
              Ce signalement sera visible par <strong>la direction</strong> et <strong>les parents</strong> de l'élève.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Selec label="Type" value={formIncident.type || "Absence"} onChange={(e) => setFormIncident((p) => ({ ...p, type: e.target.value }))}>
                <option>Absence</option>
                <option>Retard</option>
                <option>Avertissement</option>
                <option>Sanction</option>
                <option>Renvoi temporaire</option>
              </Selec>
              <Input label="Date" type="date" value={formIncident.date || ""} onChange={(e) => setFormIncident((p) => ({ ...p, date: e.target.value }))} />
              <Selec label="Justifié ?" value={formIncident.justifie || "Non"} onChange={(e) => setFormIncident((p) => ({ ...p, justifie: e.target.value }))}>
                <option>Non</option>
                <option>Oui</option>
              </Selec>
              <div style={{ display: "flex", alignItems: "flex-end", fontSize: 11, color: "#6b7280" }}>
                Classe : <strong style={{ marginLeft: 4 }}>{formIncident.classe || "—"}</strong>
              </div>
            </div>
            <div style={{ height: 10 }} />
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: c1, marginBottom: 4 }}>Motif / Description</label>
            <textarea
              rows={3}
              value={formIncident.motif || ""}
              onChange={(e) => setFormIncident((p) => ({ ...p, motif: e.target.value }))}
              placeholder="Ex : Bavardage répété, n'a pas rendu son devoir, absent sans justification..."
              maxLength={500}
              style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "8px 11px", fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }}
            />
            <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", marginTop: 2 }}>{(formIncident.motif || "").length} / 500</div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Btn v="ghost" onClick={() => setModalIncident(null)}>Annuler</Btn>
              <Btn v="amber" onClick={enregistrerIncident} disabled={enregistrement}>{enregistrement ? "Enregistrement..." : "✅ Enregistrer le signalement"}</Btn>
            </div>
          </Modale>
        )}
      </div>
    </div>
  );
}

export { PortailEnseignant };
