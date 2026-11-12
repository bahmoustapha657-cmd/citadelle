import { useTranslation } from "react-i18next";
import { nettoyerSurnom } from "../../identite-enfant";
import { nomAffiche } from "../../ordre-eleves";
import { Card, Vide } from "../ui";
import { PhotoEleve } from "../identite-enfant/PhotoEleve";
import { compterAppel, etatEleve, nbEcritures } from "./appel-logic";
import { cleSeance, libelleSeance } from "./seances";

// Appel d'une classe : tout le monde est présent par défaut, l'enseignant ne
// touche que les absents et les retardataires, puis enregistre une seule
// fois. Rien ne s'écrit ni ne se recharge entre deux élèves : la liste reste
// où il s'est arrêté.
const ETATS = [
  { etat: "present", cle: "present", fond: "#16a34a" },
  { etat: "absent", cle: "absent", fond: "#dc2626" },
  { etat: "retard", cle: "late", fond: "#d97706" },
];
const FOND_LIGNE = { present: "#fff", absent: "#fef2f2", retard: "#fffbeb" };
const champHeure = { minHeight: 38, border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "0 6px", fontSize: 13, fontFamily: "inherit" };

// Choix du cours appelé (secondaire) : les cours du professeur dans la classe
// ce jour-là, puis « autre heure » (cours absent de l'emploi du temps).
function ChoixCours({ c1, appel }) {
  const { t } = useTranslation();
  const puce = (actif) => ({
    minHeight: 38, padding: "0 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 800, cursor: "pointer",
    border: `1.5px solid ${actif ? c1 : "#cbd5e1"}`, background: actif ? c1 : "#fff", color: actif ? "#fff" : "#334155",
  });
  const autre = appel.seanceChoisie === "autre";
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 800, color: "#475569" }}>🕘 {t("teacher.rollCall.course")}</span>
      {appel.seances.map((s) => {
        const cle = cleSeance(s);
        const actif = !autre && cle === appel.seanceChoisie;
        return (
          <button key={cle} type="button" aria-pressed={actif} onClick={() => appel.choisirSeance(cle)} style={puce(actif)}>
            {libelleSeance(s)}{s.matiere ? ` · ${s.matiere}` : ""}
          </button>
        );
      })}
      <button type="button" aria-pressed={autre} onClick={() => appel.choisirSeance("autre")} style={puce(autre)}>
        {t("teacher.rollCall.otherTime")}
      </button>
      {autre && (
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569" }}>
          <input type="time" aria-label={t("teacher.rollCall.from")} value={appel.seanceLibre.heureDebut}
            onChange={(e) => appel.changerSeanceLibre("heureDebut", e.target.value)} style={champHeure} />
          →
          <input type="time" aria-label={t("teacher.rollCall.to")} value={appel.seanceLibre.heureFin}
            onChange={(e) => appel.changerSeanceLibre("heureFin", e.target.value)} style={champHeure} />
        </span>
      )}
      {!appel.seance && <span style={{ fontSize: 12, fontWeight: 700, color: "#b91c1c" }}>{t("teacher.rollCall.courseRequired")}</span>}
    </div>
  );
}

// Ce que les autres cours du jour ont noté pour un élève (pour information).
function AutresCours({ liste = [] }) {
  const { t } = useTranslation();
  if (!liste.length) return null;
  return (
    <div style={{ fontSize: 11, color: "#64748b" }}>
      {liste.map((a, i) => (
        <div key={i}>
          {a.etat === "absent" ? "🔴" : "🟠"} {t(a.etat === "absent" ? "teacher.rollCall.elsewhereAbsent" : "teacher.rollCall.elsewhereLate", {
            when: a.quand || t("teacher.rollCall.allDay"), subject: a.matiere ? ` · ${a.matiere}` : "",
          })}
        </div>
      ))}
    </div>
  );
}

export function AppelVue({ c1, mesClasses, appel, enregistrement, ouvrirSignalementEleve, onAgrandir, triEleves }) {
  const { t } = useTranslation();
  const { eleves, situation, marques } = appel;
  const bilan = compterAppel(eleves, situation, marques);
  const aEcrire = nbEcritures(appel.plan);
  // Déjà fait et rien de nouveau coché : plus rien à enregistrer.
  const rienAFaire = aEcrire === 0 && Boolean(appel.faitA);

  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {mesClasses.length > 1 && mesClasses.map((classe) => (
          <button key={classe} type="button" onClick={() => appel.setClasse(classe)} aria-pressed={classe === appel.classe}
            style={{
              minHeight: 38, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer",
              border: `1.5px solid ${classe === appel.classe ? c1 : "#cbd5e1"}`,
              background: classe === appel.classe ? c1 : "#fff", color: classe === appel.classe ? "#fff" : "#334155",
            }}>
            {classe}
          </button>
        ))}
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569", marginInlineStart: "auto" }}>
          {t("teacher.rollCall.date")}
          <input type="date" value={appel.date} max={appel.aujourdhui} onChange={(e) => appel.setDate(e.target.value)}
            style={{ minHeight: 38, border: "1.5px solid #cbd5e1", borderRadius: 8, padding: "0 8px", fontSize: 13, fontFamily: "inherit" }} />
        </label>
      </div>
      {appel.parCours && <ChoixCours c1={c1} appel={appel} />}
      <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>{t(appel.parCours ? "teacher.rollCall.hintCourse" : "teacher.rollCall.hint")}</div>

      {eleves.length === 0 ? (
        <Vide icone="👥" msg={t("teacher.rollCall.noStudent")} />
      ) : (
        <Card>
          {eleves.map((eleve, index) => {
            const etat = etatEleve(eleve._id, situation, marques);
            const enregistre = situation.get(eleve._id);
            const verrouille = Boolean(enregistre && !enregistre.modifiable);
            const surnom = nettoyerSurnom(eleve.surnom);
            return (
              <div key={eleve._id} data-appel-etat={etat}
                style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "8px 12px", borderBottom: "1px solid #f1f5f9", background: FOND_LIGNE[etat] }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 170px", minWidth: 0 }}>
                  <span style={{ width: 20, fontSize: 11, color: "#94a3b8", textAlign: "end", flexShrink: 0 }}>{index + 1}</span>
                  <PhotoEleve eleve={eleve} largeur={34} onClick={onAgrandir} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>{nomAffiche(eleve, triEleves)}</div>
                    {surnom && <div style={{ fontSize: 11, fontWeight: 700, color: "#b45309" }}>« {surnom} »</div>}
                    {appel.parCours && <AutresCours liste={appel.autresCours.get(eleve._id)} />}
                    {verrouille && (
                      <div style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>
                        {t("teacher.abs.reportedBy", { name: enregistre.auteur || t("teacher.abs.theManagement") })}
                      </div>
                    )}
                  </div>
                </div>
                <div role="group" aria-label={nomAffiche(eleve, triEleves)} style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {ETATS.map(({ etat: choix, cle, fond }) => {
                    const actif = etat === choix;
                    return (
                      <button key={choix} type="button" aria-pressed={actif} disabled={verrouille || enregistrement}
                        onClick={() => appel.marquer(eleve._id, choix)}
                        style={{
                          minHeight: 40, minWidth: 72, padding: "0 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 800,
                          cursor: verrouille ? "not-allowed" : "pointer",
                          border: `1.5px solid ${actif ? fond : "#cbd5e1"}`,
                          background: actif ? fond : "#fff", color: actif ? "#fff" : "#475569",
                          opacity: verrouille && !actif ? 0.45 : 1,
                        }}>
                        {t(`teacher.rollCall.${cle}`)}
                      </button>
                    );
                  })}
                  <button type="button" onClick={() => ouvrirSignalementEleve(eleve)}
                    title={t("teacher.rollCall.other")} aria-label={t("teacher.rollCall.other")}
                    style={{ minHeight: 40, minWidth: 40, borderRadius: 8, border: "1.5px solid #fcd34d", background: "#fffbeb", cursor: "pointer", fontSize: 15 }}>
                    ⚠️
                  </button>
                </div>
              </div>
            );
          })}
        </Card>
      )}

      {eleves.length > 0 && (
        <div style={{
          position: "sticky", bottom: 0, zIndex: 5, marginTop: 12, padding: "10px 12px", background: "#fff",
          border: "1px solid #e2e8f0", borderRadius: 12, boxShadow: "0 -4px 16px rgba(15,23,42,0.10)",
          display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
        }}>
          <div style={{ flex: "1 1 200px", fontSize: 12.5, fontWeight: 700, color: "#334155" }}>
            {t("teacher.rollCall.summary", { total: eleves.length, presents: bilan.presents, absents: bilan.absents, retards: bilan.retards })}
            {appel.faitA && <div style={{ fontSize: 11.5, fontWeight: 700, color: "#15803d" }}>✅ {t("teacher.rollCall.doneAt", { time: appel.faitA })}</div>}
          </div>
          <button type="button" onClick={appel.enregistrer} disabled={enregistrement || rienAFaire || (appel.parCours && !appel.seance)}
            style={{
              minHeight: 46, padding: "0 18px", borderRadius: 10, border: "none", fontSize: 14, fontWeight: 900,
              background: rienAFaire ? "#cbd5e1" : c1, color: "#fff", cursor: enregistrement || rienAFaire ? "default" : "pointer",
              flex: "1 1 200px",
            }}>
            {enregistrement ? t("teacher.incident.saving")
              : aEcrire > 0 ? `✅ ${t("teacher.rollCall.saveCount", { n: aEcrire })}`
                : bilan.absents + bilan.retards === 0 ? `✅ ${t("teacher.rollCall.validateAll")}`
                  : `✅ ${t("teacher.rollCall.save")}`}
          </button>
        </div>
      )}
    </>
  );
}
