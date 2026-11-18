import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Input, Modale, Selec } from "../../ui";

// Espace d'un enseignant indépendant : correction d'un élève mal saisi (nom,
// prénom, sexe, classe), ou retrait de ses listes. Ailleurs, la fiche se
// reprend en Comptabilité.
//
// `modifierChamp(id, champs)` (et non `modifier`, qui n'attend qu'un objet :
// hors ligne, l'appel à deux arguments ne modifiait rien sans erreur).
export function EleveEnseignantModale({ eleve, classes = [], modifierChamp, supprimer, toast, logAction, fermer }) {
  const { t } = useTranslation();
  const nomsClasses = useMemo(() => [...new Set([eleve.classe, ...classes.map((c) => c.nom)].filter(Boolean))], [classes, eleve.classe]);
  const [form, setForm] = useState({
    nom: eleve.nom || "", prenom: eleve.prenom || "", sexe: eleve.sexe || "M", classe: eleve.classe || "",
  });
  const [enCours, setEnCours] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const verrou = useRef(false);
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const nomComplet = `${eleve.prenom || ""} ${eleve.nom || ""}`.trim();

  const agir = async (action) => {
    if (verrou.current) return;
    verrou.current = true;
    setEnCours(true);
    try {
      await action();
      fermer();
    } catch (e) {
      toast(t("school.students.teacherEdit.saveError", { error: e?.message || e }), "error");
    } finally {
      setEnCours(false);
      verrou.current = false;
    }
  };

  const enregistrer = () => {
    const champs = { nom: form.nom.trim(), prenom: form.prenom.trim(), sexe: form.sexe, classe: form.classe };
    if (!champs.nom || !champs.prenom) { toast(t("school.students.teacherEdit.nameRequired"), "warning"); return; }
    agir(async () => {
      await modifierChamp(eleve._id, champs);
      toast(t("school.students.teacherEdit.saved"), "success");
    });
  };

  const retirer = () => agir(async () => {
    await supprimer(eleve._id);
    // Journal de l'école : en français, comme toutes ses entrées. i18n-ignore
    logAction?.("Élève retiré par l'enseignant", `${eleve.nom} ${eleve.prenom} (${eleve.classe})`);
    toast(t("school.students.teacherEdit.removed", { name: nomComplet }), "success");
  });

  return (
    <Modale titre={`✏️ ${t("school.students.teacherEdit.title")}`} fermer={enCours ? () => {} : fermer}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Input label={t("enrolment.lastName")} value={form.nom} onChange={chg("nom")} />
        <Input label={t("enrolment.firstName")} value={form.prenom} onChange={chg("prenom")} />
        <Selec label={t("enrolment.sex")} value={form.sexe} onChange={chg("sexe")}>
          <option value="M">{t("enrolment.male")}</option>
          <option value="F">{t("enrolment.female")}</option>
        </Selec>
        <Selec label={t("enrolment.class")} value={form.classe} onChange={chg("classe")}>
          {nomsClasses.map((c) => <option key={c}>{c}</option>)}
        </Selec>
      </div>
      {confirmer ? (
        <div style={{ marginTop: 14, padding: "10px 12px", background: "rgba(239,68,68,0.08)", border: "1px solid #fecaca", borderRadius: 8, fontSize: 12.5, color: "#b91c1c" }}>
          {t("school.students.teacherEdit.confirmRemove", { name: nomComplet })}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Btn sm v="ghost" onClick={() => setConfirmer(false)} disabled={enCours}>{t("common.no")}</Btn>
            <Btn sm v="danger" onClick={retirer} disabled={enCours}>{t("school.students.teacherEdit.yesRemove")}</Btn>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <Btn v="ghost" onClick={() => setConfirmer(true)} disabled={enCours}>🗑️ {t("school.students.teacherEdit.remove")}</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("common.cancel")}</Btn>
            <Btn onClick={enregistrer} disabled={enCours}>
              {enCours ? `⏳ ${t("school.students.teacherEdit.saving")}` : `✅ ${t("common.save")}`}
            </Btn>
          </div>
        </div>
      )}
    </Modale>
  );
}
