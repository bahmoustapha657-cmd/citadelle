import React, { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiFetch, getAuthHeaders } from "../apiClient";
import { C, CLASSES_PRIMAIRE, getTarifAutreValue, getTarifMensuelTotal } from "../constants";
import { getPeriodesForSection } from "../period-utils";
import { SchoolContext } from "../contexts/SchoolContext";
import { GlobalStyles } from "../styles";
import { Badge, Chargement } from "./ui";
import { normalizeText } from "./portail-parent/helpers";
import { DashboardTab } from "./portail-parent/DashboardTab";
import { NotesTab } from "./portail-parent/NotesTab";
import { AbsencesTab } from "./portail-parent/AbsencesTab";
import { BulletinsTab } from "./portail-parent/BulletinsTab";
import { PaiementsTab } from "./portail-parent/PaiementsTab";
import { MessagesTab } from "./portail-parent/MessagesTab";

function PortailParent({ utilisateur, deconnecter, annee, schoolInfo }) {
  const { t } = useTranslation();
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
  // Périodicité dépend de la section de l'enfant courant (primaire vs secondaire).
  const sectionPeriode = CLASSES_PRIMAIRE.includes(eleve.classe) ? "primaire" : "secondaire";
  const periodes = getPeriodesForSection(schoolInfo, sectionPeriode, moisAnnee);
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
    { id: "dashboard", label: t("parent.tabs.overview") },
    { id: "notes", label: t("parent.tabs.grades"), bloque: accesBloqueParPaiement },
    { id: "absences", label: t("parent.tabs.absences") },
    { id: "bulletins", label: t("parent.tabs.bulletin"), bloque: accesBloqueParPaiement },
    { id: "paiements", label: t("parent.tabs.fees") },
    { id: "messages", label: `${t("parent.tabs.messages")}${nonLus > 0 ? ` (${nonLus})` : ""}` },
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
              <DashboardTab
                annonces={annonces}
                mesNotes={mesNotes}
                mesAbsences={mesAbsences}
                matieres={matieres}
                eleve={eleve}
                c1={c1}
                onVoirNotes={() => setTab("notes")}
              />
            )}

            {tab === "notes" && (
              <NotesTab
                accesBloqueParPaiement={accesBloqueParPaiement}
                moisImpayes={moisImpayes}
                schoolInfo={schoolInfo}
                onPaiements={() => setTab("paiements")}
                mesNotes={mesNotes}
                matieres={matieres}
                eleve={eleve}
                eleveNom={eleveNom}
                c1={c1}
              />
            )}

            {tab === "absences" && (
              <AbsencesTab mesAbsences={mesAbsences} c1={c1} />
            )}

            {tab === "bulletins" && (
              <BulletinsTab
                accesBloqueParPaiement={accesBloqueParPaiement}
                moisImpayes={moisImpayes}
                schoolInfo={schoolInfo}
                onPaiements={() => setTab("paiements")}
                periodes={periodes}
                mesNotes={mesNotes}
                eleve={eleve}
                eleveNom={eleveNom}
                section={section}
                c1={c1}
                c2={c2}
              />
            )}

            {tab === "paiements" && (
              <PaiementsTab
                eleve={eleve}
                moisAnnee={moisAnnee}
                estReinscription={estReinscription}
                montantInscription={montantInscription}
                montantAutre={montantAutre}
                montantMensuel={montantMensuel}
                c1={c1}
                c2={c2}
              />
            )}

            {tab === "messages" && (
              <MessagesTab
                mesMessages={mesMessages}
                sujet={sujet}
                setSujet={setSujet}
                corps={corps}
                setCorps={setCorps}
                envoi={envoi}
                envoyer={envoyer}
                c1={c1}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export { PortailParent };
