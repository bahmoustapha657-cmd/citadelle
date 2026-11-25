import { useContext } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Input, Modale, Selec } from "../../ui";
import { AvisFormeNote } from "../../AvisFormeNote";
import { nomAffiche } from "../../../ordre-eleves";
import { SchoolContext } from "../../../contexts/SchoolContext";
import { champMois, moisSaisi } from "../../../notes-mois";
import { libelleMoisCode } from "../../../i18n/libelles";

// Modale de création / édition d'une note unitaire.
// Oraux et écrits du secondaire : mois de l'évaluation, parmi ceux de la
// période (le mois en cours d'office) — notes-mois.js.
export function NoteModale({
  modalNote, setModalNote, formNote, setFormNote,
  eleves, noteForms, defaultNoteType, periodeN, periodes, maxNote = 20,
  isPrimaire = false, matieresDispo = [], section = "secondaire",
  enregistrement, enregistrerNote, triEleves,
}) {
  // Même règle que la grille : choix de la matière pour le titulaire, ou
  // pour le professeur du secondaire à qui des matières sont rattachées.
  const choixMatiere = isPrimaire || matieresDispo.length > 1;
  const { t } = useTranslation();
  const { moisAnnee = [] } = useContext(SchoolContext);
  const saisie = { type: formNote.type || defaultNoteType, section, periode: formNote.periode || periodeN, moisAnnee };
  const champ = champMois(saisie);
  const mois = moisSaisi({ ...saisie, mois: formNote.mois || "" });
  return (
    <Modale titre={modalNote === "add" ? t("teacher.noteModal.new") : t("teacher.noteModal.edit")} fermer={() => setModalNote(null)}>
      <Selec
        label={t("teacher.noteModal.student")}
        value={formNote.eleveId || ""}
        onChange={(event) => setFormNote((current) => ({ ...current, eleveId: event.target.value }))}
      >
        <option value="">{t("teacher.noteModal.choose")}</option>
        {eleves.map((eleveItem) => (
          <option key={eleveItem._id} value={eleveItem._id}>
            {nomAffiche(eleveItem, triEleves)} ({eleveItem.classe})
          </option>
        ))}
      </Selec>
      <div style={{ height: 10 }} />
      {choixMatiere && (
        <>
          <Selec
            label={t("teacher.noteModal.subject")}
            value={formNote.matiere || ""}
            onChange={(event) => setFormNote((current) => ({ ...current, matiere: event.target.value }))}
          >
            {matieresDispo.map((m) => <option key={m._id || m.nom} value={m.nom}>{m.nom}</option>)}
            {formNote.matiere && !matieresDispo.some((m) => m.nom === formNote.matiere)
              && <option value={formNote.matiere}>{formNote.matiere}</option>}
          </Selec>
          <div style={{ height: 10 }} />
        </>
      )}
      <Selec
        label={t("teacher.noteModal.type")}
        value={formNote.type || defaultNoteType}
        onChange={(event) => setFormNote((current) => ({ ...current, type: event.target.value }))}
      >
        {noteForms.map((item) => <option key={item.id} value={item.value}>{item.label}</option>)}
      </Selec>
      <AvisFormeNote type={formNote.type || defaultNoteType} style={{ marginTop: 8 }} />
      <div style={{ height: 10 }} />
      <Selec
        label={t("teacher.noteModal.period")}
        value={formNote.periode || periodeN}
        onChange={(event) => setFormNote((current) => ({ ...current, periode: event.target.value }))}
      >
        {periodes.map((p) => <option key={p}>{p}</option>)}
      </Selec>
      <div style={{ height: 10 }} />
      {champ.visible && (
        <>
          <Selec
            label={t("gradeMonth.label")}
            value={mois}
            onChange={(event) => setFormNote((current) => ({ ...current, mois: event.target.value }))}
          >
            <option value="">{t("gradeMonth.choose")}</option>
            {champ.choix.map((m) => <option key={m} value={m}>{libelleMoisCode(m)}</option>)}
          </Selec>
          <div style={{ height: 10 }} />
        </>
      )}
      <Input
        label={t("teacher.cols.gradeOutOf", { max: maxNote })}
        type="number"
        min="0"
        max={maxNote}
        step="0.25"
        value={formNote.note ?? ""}
        onChange={(event) => setFormNote((current) => ({ ...current, note: event.target.value }))}
        placeholder={t("teacher.noteModal.example", { value: maxNote * 0.7 })}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => setModalNote(null)}>{t("common.cancel")}</Btn>
        <Btn onClick={enregistrerNote} disabled={enregistrement}>{enregistrement ? t("teacher.noteModal.saving") : t("teacher.noteModal.save")}</Btn>
      </div>
    </Modale>
  );
}
