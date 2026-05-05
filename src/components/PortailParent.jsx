import React, { useContext, useEffect, useMemo, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip } from "recharts";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C, fmt, getTarifAutreValue, getTarifMensuelTotal } from "../constants";
import { getGeneralAverage, getSubjectAverage } from "../note-utils";
import { SchoolContext } from "../contexts/SchoolContext";
import { imprimerBulletin } from "../reports";
import { GlobalStyles } from "../styles";
import { BlocagePaiement } from "./BlocagePaiement";
import { Badge, Btn, Card, Champ, Chargement, Input, TD, THead, TR, Vide } from "./ui";

function normalizeText(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function PortailParent({ utilisateur, deconnecter, annee, schoolInfo }) {
  const { toast, moisAnnee } = useContext(SchoolContext);
  const c1 = schoolInfo.couleur1 || C.blue;
  const c2 = schoolInfo.couleur2 || C.green;

  const [tab, setTab] = useState("dashboard");
  const [sujet, setSujet] = useState("");
  const [corps, setCorps] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [chargement, setChargement] = useState(true);
  const [portalData, setPortalData] = useState({
    eleves: [],
    notes: [],
    absences: [],
    messages: [],
    tarifs: [],
    annonces: [],
  });
  const [eleveActifId, setEleveActifId] = useState(utilisateur.eleveId || "");

  const eleves = portalData.eleves || [];
  const notes = portalData.notes;
  const absences = portalData.absences;
  const messages = portalData.messages;
  const tarifs = portalData.tarifs || [];
  const annonces = portalData.annonces || [];

  const eleve = eleves.find((item) => item._id === eleveActifId) || eleves[0] || {};
  const eleveId = eleve._id || utilisateur.eleveId || null;
  const eleveNom = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim() || utilisateur.eleveNom || "";
  const section = eleve.section || utilisateur.section || "college";

  const mesNotes = useMemo(
    () => notes.filter((item) => item.eleveId === eleveId),
    [notes, eleveId],
  );
  const mesAbsences = useMemo(
    () => absences.filter((item) => item.eleveId === eleveId),
    [absences, eleveId],
  );
  const mesMessages = useMemo(
    () => [...messages]
      .filter((item) => item.eleveId === eleveId)
      .sort((left, right) => Number(right.date || 0) - Number(left.date || 0)),
    [messages, eleveId],
  );
  const nonLus = mesMessages.filter((item) => item.expediteur === "ecole" && !item.lu).length;

  const tarifEleve = tarifs.find((item) => item.classe === eleve.classe) || null;
  const montantMensuel = getTarifMensuelTotal(tarifEleve, eleve.classe);
  const montantAutre = getTarifAutreValue(tarifEleve);
  const typeInscription = normalizeText(eleve.typeInscription);
  const estReinscription = typeInscription === "reinscription";
  const montantInscription = estReinscription
    ? Number(tarifEleve?.reinscription || 0)
    : Number(tarifEleve?.inscription || 0);
  const matieres = [...new Set(mesNotes.map((item) => item.matiere).filter(Boolean))];

  const blocageActif = !!schoolInfo.blocageParentImpaye;
  const moisImpayes = moisAnnee.filter((mois) => normalizeText((eleve.mens || {})[mois]) !== "paye");
  const accesBloqueParPaiement = blocageActif && moisImpayes.length > 0;

  const chargerPortail = async () => {
    setChargement(true);
    try {
      const headers = await getAuthHeaders();
      const res = await apiFetch("/parent-portal", { headers });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Chargement impossible.");
      }

      setPortalData({
        eleves: Array.isArray(data.eleves) ? data.eleves : [],
        notes: Array.isArray(data.notes) ? data.notes : [],
        absences: Array.isArray(data.absences) ? data.absences : [],
        messages: Array.isArray(data.messages) ? data.messages : [],
        tarifs: Array.isArray(data.tarifs) ? data.tarifs : [],
        annonces: Array.isArray(data.annonces) ? data.annonces : [],
      });
      setEleveActifId((current) => current || utilisateur.eleveId || data.eleves?.[0]?._id || "");
    } catch (error) {
      toast(error.message || "Erreur de chargement du portail parent.", "error");
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    chargerPortail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const envoyer = async () => {
    if (!sujet.trim() || !corps.trim()) {
      toast("Sujet et message requis.", "warning");
      return;
    }
    if (!eleveId) {
      toast("Eleve introuvable pour ce compte parent.", "warning");
      return;
    }

    setEnvoi(true);
    try {
      const headers = await getAuthHeaders({ "Content-Type": "application/json" });
      const res = await apiFetch("/parent-portal", {
        method: "POST",
        headers,
        body: JSON.stringify({
          eleveId,
          sujet: sujet.trim(),
          corps: corps.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Envoi impossible.");
      }
      setSujet("");
      setCorps("");
      await chargerPortail();
    } catch (error) {
      toast(error.message || "Erreur d'envoi.", "error");
    } finally {
      setEnvoi(false);
    }
  };

  const tabs = [
    { id: "dashboard", label: "Dashboard" },
    { id: "notes", label: "Notes", bloque: accesBloqueParPaiement },
    { id: "absences", label: "Absences" },
    { id: "bulletins", label: "Bulletins", bloque: accesBloqueParPaiement },
    { id: "paiements", label: "Paiements" },
    { id: "messages", label: `Messages${nonLus > 0 ? ` (${nonLus})` : ""}` },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter','Segoe UI',sans-serif" }}>
      <GlobalStyles />
      <div style={{ background: `linear-gradient(135deg,${c1},${c1}ee)`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}>
        {schoolInfo.logo && <img src={schoolInfo.logo} alt="logo" style={{ width: 38, height: 38, objectFit: "contain", borderRadius: 8, background: "rgba(255,255,255,0.15)", padding: 4 }} />}
        <div style={{ flex: 1 }}>
          <div style={{ color: c2, fontWeight: 900, fontSize: 15 }}>{schoolInfo.nom || "Ecole"}</div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>Portail parent - {annee}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>{utilisateur.nom}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <Badge color="teal">Parent</Badge>
            <button onClick={deconnecter} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff", padding: "3px 10px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 700 }}>Deconnexion</button>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "1px solid #f1f5f9", padding: "14px 24px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg,${c1},${c2})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 900, flexShrink: 0 }}>
          {(eleveNom || "E")[0]}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: "#0A1628" }}>{eleveNom || "Aucun eleve"}</div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            {eleve.classe && <span style={{ background: "#e0ebf8", color: c1, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginRight: 8 }}>{eleve.classe}</span>}
            {eleve.matricule && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>#{eleve.matricule}</span>}
          </div>
          {eleves.length > 1 && (
            <div style={{ marginTop: 10, maxWidth: 280 }}>
              <select value={eleveId || ""} onChange={(event) => setEleveActifId(event.target.value)} style={{ width: "100%", border: "1.5px solid #dbe5f0", borderRadius: 8, padding: "7px 10px", fontSize: 12, background: "#fff" }}>
                {eleves.map((item) => (
                  <option key={item._id} value={item._id}>
                    {`${item.prenom || ""} ${item.nom || ""}`.trim()} {item.classe ? `- ${item.classe}` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", padding: "8px 16px", background: "#f0fdf4", borderRadius: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: C.greenDk }}>{mesNotes.length}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Notes</div>
          </div>
          <div style={{ textAlign: "center", padding: "8px 16px", background: "#fff1f2", borderRadius: 10 }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#b91c1c" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "absent").length}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Absences</div>
          </div>
          {nonLus > 0 && (
            <div style={{ textAlign: "center", padding: "8px 16px", background: "#fef3c7", borderRadius: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#d97706" }}>{nonLus}</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>Non lus</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ background: "#fff", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", gap: 0, overflowX: "auto" }}>
        {tabs.map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            style={{
              padding: "13px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: tab === item.id ? c1 : item.bloque ? "#ef4444" : "#64748b",
              borderBottom: tab === item.id ? `3px solid ${c1}` : "3px solid transparent",
              opacity: item.bloque && tab !== item.id ? 0.75 : 1,
            }}
          >
            {item.bloque ? "Bloque - " : ""}
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ padding: "24px", maxWidth: 1000, margin: "0 auto" }}>
        {chargement ? (
          <Chargement rows={5} />
        ) : (
          <>
            {tab === "dashboard" && (
              <>
                {annonces.length > 0 && (
                  <div style={{ marginBottom: 20 }}>
                    {[...annonces].sort((left, right) => Number(right.date || 0) - Number(left.date || 0)).slice(0, 3).map((annonce, index) => (
                      <div key={index} style={{ background: annonce.important ? "linear-gradient(135deg,#fef3c7,#fffbeb)" : "#f8fafc", border: `1px solid ${annonce.important ? "#fcd34d" : "#e2e8f0"}`, borderLeft: `4px solid ${annonce.important ? "#f59e0b" : c1}`, borderRadius: "0 12px 12px 0", padding: "12px 18px", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <strong style={{ fontSize: 13, color: "#0A1628" }}>{annonce.titre}</strong>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "#94a3b8" }}>{annonce.auteur} - {annonce.date ? new Date(annonce.date).toLocaleDateString("fr-FR") : ""}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>{annonce.corps}</p>
                      </div>
                    ))}
                  </div>
                )}

                {mesNotes.length > 0 && (
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <strong style={{ fontSize: 13, color: c1 }}>Dernieres notes</strong>
                      <button onClick={() => setTab("notes")} style={{ fontSize: 12, color: c1, background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>Voir tout</button>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <THead cols={["Matiere", "Type", "Periode", "Note"]} />
                        <tbody>
                          {mesNotes.slice(-6).reverse().map((item, index) => (
                            <TR key={index}>
                              <TD bold>{item.matiere}</TD>
                              <TD><Badge color="blue">{item.type}</Badge></TD>
                              <TD>{item.periode}</TD>
                              <TD center><strong style={{ color: Number(item.note) >= 10 ? C.greenDk : "#b91c1c", fontSize: 14 }}>{item.note}/20</strong></TD>
                            </TR>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {mesAbsences.filter((item) => normalizeText(item.statut) === "absent").length > 0 && (
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                      <strong style={{ fontSize: 13, color: "#b91c1c" }}>Absences recentes</strong>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <THead cols={["Date", "Matiere", "Statut", "Motif"]} />
                        <tbody>
                          {mesAbsences.filter((item) => normalizeText(item.statut) === "absent").slice(-5).map((item, index) => (
                            <TR key={index}>
                              <TD>{item.date || "-"}</TD>
                              <TD>{item.matiere || "-"}</TD>
                              <TD><Badge color="red">Absent</Badge></TD>
                              <TD>{item.motif || "-"}</TD>
                            </TR>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                )}

                {mesNotes.length > 0 && matieres.length >= 3 && (
                  <Card style={{ marginBottom: 16 }}>
                    <div style={{ padding: "14px 18px" }}>
                      <p style={{ margin: "0 0 8px", fontWeight: 800, fontSize: 13, color: c1 }}>Profil par matiere</p>
                      <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={matieres.map((matiere) => {
                          const notesMatiere = mesNotes.filter((item) => item.matiere === matiere);
                          const moyenne = getSubjectAverage(notesMatiere, eleve.classe) || 0;
                          return { matiere: matiere.length > 10 ? `${matiere.slice(0, 10)}...` : matiere, valeur: Math.round(moyenne * 10) / 10, plein: 20 };
                        })}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis dataKey="matiere" tick={{ fontSize: 10 }} />
                          <Radar name="Note" dataKey="valeur" stroke={c1} fill={c1} fillOpacity={0.25} />
                          <Radar name="Max" dataKey="plein" stroke="transparent" fill="transparent" />
                          <Tooltip formatter={(value) => `${value}/20`} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                )}

                {mesNotes.length === 0 && mesAbsences.length === 0 && <Vide icone="Info" msg="Aucune donnee disponible pour le moment" />}
              </>
            )}

            {tab === "notes" && (
              <>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Notes de {eleveNom}</h2>
                {accesBloqueParPaiement ? (
                  <BlocagePaiement moisImpayes={moisImpayes} schoolInfo={schoolInfo} onPaiements={() => setTab("paiements")} />
                ) : mesNotes.length === 0 ? (
                  <Vide icone="Notes" msg="Aucune note disponible" />
                ) : (
                  matieres.map((matiere) => {
                    const notesMatiere = mesNotes.filter((item) => item.matiere === matiere);
                    const moyenne = (getSubjectAverage(notesMatiere, eleve.classe) || 0).toFixed(1);
                    return (
                      <Card key={matiere} style={{ marginBottom: 12 }}>
                        <div style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10 }}>
                          <strong style={{ fontSize: 13, color: c1, flex: 1 }}>{matiere}</strong>
                          <span style={{ background: Number(moyenne) >= 10 ? "#dcfce7" : "#fee2e2", color: Number(moyenne) >= 10 ? "#166534" : "#b91c1c", fontWeight: 900, fontSize: 13, padding: "4px 12px", borderRadius: 20 }}>Moy. {moyenne}/20</span>
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <THead cols={["Type", "Periode", "Note /20"]} />
                            <tbody>
                              {notesMatiere.map((item, index) => (
                                <TR key={index}>
                                  <TD><Badge color="blue">{item.type}</Badge></TD>
                                  <TD>{item.periode}</TD>
                                  <TD center><strong style={{ color: Number(item.note) >= 10 ? C.greenDk : "#b91c1c" }}>{item.note}/20</strong></TD>
                                </TR>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    );
                  })
                )}
              </>
            )}

            {tab === "absences" && (
              <>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Absences et presences</h2>
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                  <div style={{ padding: "12px 20px", background: "#fee2e2", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#b91c1c" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "absent").length}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Absences</div>
                  </div>
                  <div style={{ padding: "12px 20px", background: "#fef3c7", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#d97706" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "retard").length}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Retards</div>
                  </div>
                  <div style={{ padding: "12px 20px", background: "#dcfce7", borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontWeight: 900, fontSize: 22, color: "#166534" }}>{mesAbsences.filter((item) => normalizeText(item.statut) === "present").length}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Presences</div>
                  </div>
                </div>
                {mesAbsences.length === 0 ? (
                  <Vide icone="Absences" msg="Aucune absence enregistree" />
                ) : (
                  <Card>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <THead cols={["Date", "Matiere", "Statut", "Motif"]} />
                      <tbody>
                        {mesAbsences.map((item, index) => (
                          <TR key={index}>
                            <TD>{item.date || "-"}</TD>
                            <TD>{item.matiere || "-"}</TD>
                            <TD><Badge color={normalizeText(item.statut) === "absent" ? "red" : normalizeText(item.statut) === "retard" ? "amber" : "vert"}>{item.statut || "-"}</Badge></TD>
                            <TD>{item.motif || "-"}</TD>
                          </TR>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                )}
              </>
            )}

            {tab === "bulletins" && (
              <>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Bulletins</h2>
                {accesBloqueParPaiement && <BlocagePaiement moisImpayes={moisImpayes} schoolInfo={schoolInfo} onPaiements={() => setTab("paiements")} />}
                {!accesBloqueParPaiement && <>
                  {["T1", "T2", "T3"].map((periode) => {
                    const notesPeriode = mesNotes.filter((item) => item.periode === periode);
                    if (notesPeriode.length === 0) return null;
                    const matieresPeriode = [...new Set(notesPeriode.map((item) => item.matiere))].map((nom) => ({ nom }));
                    const moyenne = (getGeneralAverage(notesPeriode, matieresPeriode, eleve.classe) || 0).toFixed(1);
                    return (
                      <Card key={periode} style={{ marginBottom: 12 }}>
                        <div style={{ padding: "12px 18px", background: `linear-gradient(135deg,${c1},${c1}cc)`, borderRadius: "14px 14px 0 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                          <strong style={{ color: "#fff", fontSize: 14 }}>Bulletin - {periode}</strong>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <span style={{ background: c2, color: "#fff", fontWeight: 900, fontSize: 13, padding: "4px 14px", borderRadius: 20 }}>Moy. {moyenne}/20</span>
                            <button
                              onClick={() => imprimerBulletin(
                                { ...eleve, nom: eleve.nom || eleveNom.split(" ").slice(-1)[0] || eleveNom, prenom: eleve.prenom || eleveNom.split(" ").slice(0, -1).join(" ") },
                                notesPeriode,
                                [...new Set(notesPeriode.map((item) => item.matiere))].map((nom) => ({ nom })),
                                periode,
                                section === "primaire" ? "Primaire" : "Secondaire",
                                section === "primaire" ? 10 : 20,
                                schoolInfo,
                              )}
                              style={{ background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.4)", color: "#fff", padding: "4px 10px", borderRadius: 8, fontSize: 11, cursor: "pointer", fontWeight: 700 }}
                            >
                              Imprimer
                            </button>
                          </div>
                        </div>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <THead cols={["Matiere", "Type", "Note /20"]} />
                          <tbody>
                            {notesPeriode.map((item, index) => (
                              <TR key={index}>
                                <TD bold>{item.matiere}</TD>
                                <TD><Badge color="blue">{item.type}</Badge></TD>
                                <TD center><strong style={{ color: Number(item.note) >= 10 ? C.greenDk : "#b91c1c" }}>{item.note}/20</strong></TD>
                              </TR>
                            ))}
                          </tbody>
                        </table>
                      </Card>
                    );
                  })}
                  {mesNotes.length === 0 && <Vide icone="Bulletins" msg="Aucun bulletin disponible pour le moment" />}
                </>}
              </>
            )}

            {tab === "paiements" && (
              <>
                <h2 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 900, color: c1 }}>Suivi des paiements</h2>
                {(() => {
                  const mens = eleve.mens || {};
                  const mensDates = eleve.mensDates || {};
                  const moisList = moisAnnee.length ? moisAnnee : Object.keys(mens);
                  const nbPayes = moisList.filter((mois) => normalizeText(mens[mois]) === "paye").length;
                  const nbImpayes = moisList.filter((mois) => normalizeText(mens[mois]) !== "paye").length;
                  const fraisAnnexes = [
                    {
                      id: "inscription",
                      label: estReinscription ? "Reinscription" : "Inscription",
                      montant: montantInscription,
                      paye: !!eleve.inscriptionPayee,
                      date: eleve.inscriptionDate || "",
                      couleur: eleve.inscriptionPayee ? "#dbeafe" : "#fee2e2",
                      bordure: eleve.inscriptionPayee ? "#93c5fd" : "#fca5a5",
                      texte: eleve.inscriptionPayee ? "#1d4ed8" : "#b91c1c",
                    },
                    {
                      id: "autre",
                      label: "Autre frais",
                      montant: montantAutre,
                      paye: !!eleve.autrePayee,
                      date: eleve.autreDate || "",
                      couleur: eleve.autrePayee ? "#e2e8f0" : "#fee2e2",
                      bordure: eleve.autrePayee ? "#94a3b8" : "#fca5a5",
                      texte: eleve.autrePayee ? "#334155" : "#b91c1c",
                    },
                  ].filter((item) => item.montant > 0);

                  return (
                    <>
                      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
                        <div style={{ padding: "14px 20px", background: "#dcfce7", borderRadius: 12, textAlign: "center", minWidth: 120 }}>
                          <div style={{ fontWeight: 900, fontSize: 24, color: "#166534" }}>{nbPayes}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Mois payes</div>
                        </div>
                        <div style={{ padding: "14px 20px", background: "#fee2e2", borderRadius: 12, textAlign: "center", minWidth: 120 }}>
                          <div style={{ fontWeight: 900, fontSize: 24, color: "#b91c1c" }}>{nbImpayes}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Mois impayes</div>
                        </div>
                        <div style={{ padding: "14px 20px", background: "#f0fdf4", borderRadius: 12, textAlign: "center", minWidth: 120 }}>
                          <div style={{ fontWeight: 900, fontSize: 24, color: c2 }}>{moisList.length ? Math.round((nbPayes / moisList.length) * 100) : 0}%</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Taux</div>
                        </div>
                        <div style={{ padding: "14px 20px", background: "#eff6ff", borderRadius: 12, textAlign: "center", minWidth: 150 }}>
                          <div style={{ fontWeight: 900, fontSize: 20, color: "#1d4ed8" }}>{fmt(montantMensuel)}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Mensualite</div>
                        </div>
                      </div>

                      {fraisAnnexes.length > 0 && (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 10, marginBottom: 18 }}>
                          {fraisAnnexes.map((frais) => (
                            <div key={frais.id} style={{ padding: "14px 16px", borderRadius: 14, background: frais.couleur, border: `1px solid ${frais.bordure}` }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <strong style={{ fontSize: 13, color: frais.texte }}>{frais.label}</strong>
                                <Badge color={frais.paye ? "green" : "red"}>{frais.paye ? "Paye" : "Impaye"}</Badge>
                              </div>
                              <div style={{ fontSize: 20, fontWeight: 900, color: frais.texte, marginTop: 10 }}>{fmt(frais.montant)}</div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{frais.paye && frais.date ? `Regle le ${frais.date}` : "En attente de reglement"}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8 }}>
                        {moisList.map((mois) => {
                          const paye = normalizeText(mens[mois]) === "paye";
                          return (
                            <div key={mois} style={{ padding: "12px 16px", borderRadius: 12, background: paye ? "#dcfce7" : "#fee2e2", border: `2px solid ${paye ? "#86efac" : "#fca5a5"}` }}>
                              <div style={{ fontWeight: 800, fontSize: 13, color: paye ? "#166534" : "#b91c1c" }}>{mois}</div>
                              <div style={{ fontSize: 11, marginTop: 4, color: paye ? "#15803d" : "#dc2626", fontWeight: 700 }}>{paye ? "Paye" : "Impaye"}</div>
                              {paye && mensDates[mois] && <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>{mensDates[mois]}</div>}
                            </div>
                          );
                        })}
                      </div>

                      {moisList.length === 0 && fraisAnnexes.length === 0 && <Vide icone="Paiements" msg="Aucune information de paiement" />}
                    </>
                  );
                })()}
              </>
            )}

            {tab === "messages" && (
              <>
                <h2 style={{ margin: "0 0 20px", fontSize: 16, fontWeight: 900, color: c1 }}>Messages avec l'ecole</h2>

                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
                  {mesMessages.length === 0 && <Vide icone="Messages" msg="Aucun message pour le moment" />}
                  {mesMessages.map((message, index) => {
                    const estParent = message.expediteur === "parent";
                    return (
                      <div key={index} style={{ display: "flex", flexDirection: "column", alignItems: estParent ? "flex-end" : "flex-start" }}>
                        <div style={{ maxWidth: "75%", background: estParent ? `${c1}15` : "#fff", border: `1px solid ${estParent ? `${c1}33` : "#e2e8f0"}`, borderRadius: estParent ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: estParent ? c1 : "#64748b" }}>{estParent ? "Vous" : message.expediteurNom || "Ecole"}</span>
                            <span style={{ fontSize: 10, color: "#94a3b8", marginLeft: "auto" }}>{message.date ? new Date(message.date).toLocaleDateString("fr-FR") : ""}</span>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: "#0A1628", marginBottom: 4 }}>{message.sujet}</div>
                          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>{message.corps}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <Card>
                  <div style={{ padding: "14px 18px", borderBottom: "1px solid #f1f5f9" }}>
                    <strong style={{ fontSize: 13, color: c1 }}>Envoyer un message a l'ecole</strong>
                  </div>
                  <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                    <Input label="Sujet" value={sujet} onChange={(event) => setSujet(event.target.value)} placeholder="Ex : Justification d'absence" />
                    <Champ label="Message">
                      <textarea value={corps} onChange={(event) => setCorps(event.target.value)} rows={4} placeholder="Ecrivez votre message ici..." style={{ width: "100%", border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "10px 12px", fontSize: 13, resize: "vertical", outline: "none", fontFamily: "inherit" }} />
                    </Champ>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <Btn onClick={envoyer} disabled={envoi}>{envoi ? "Envoi..." : "Envoyer"}</Btn>
                    </div>
                  </div>
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { PortailParent };
