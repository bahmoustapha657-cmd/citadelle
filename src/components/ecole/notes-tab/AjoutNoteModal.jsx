import { useTranslation } from "react-i18next";
import { getAnnee } from "../../../constants";
import { Btn, Input, Modale, Selec } from "../../ui";
import { resolveCanonicalNoteType } from "../../../evaluation-forms";
import { AvisFormeNote } from "../../AvisFormeNote";
import { nomEleve } from "../../../fiche-eleve";
import { notePrete, optionsEleves } from "../../../notes-eleves";
import { champMois, moisAEnregistrer, moisAJour } from "../../../notes-mois";
import { libelleMoisCode } from "../../../i18n/libelles";

// Modale de saisie d'une note unique.
export function AjoutNoteModal({
  form, setForm, setModal,
  eleves, matieresForClasse, noteForms, defaultNoteType, maxNote,
  schoolInfo, section, periodes, moisAnnee = [], annee, ajN, toast,
}) {
  const { t } = useTranslation();
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const avertir = (msg) => { if (toast) toast(msg, "warning"); else alert(msg); };
  // Élève choisi par son identifiant : deux homonymes restent distincts.
  const eleveSelec = form.eleveId ? eleves.find((e) => e._id === form.eleveId) : null;

  // Mois de l'évaluation (oraux et écrits du secondaire) : un mois de la
  // période choisie, le mois en cours d'office s'il en fait partie.
  const type = resolveCanonicalNoteType(form.type || defaultNoteType, schoolInfo, section);
  const periode = form.periode || periodes[0] || "T1";
  const champ = champMois({ type, section, periode, moisAnnee });
  const mois = champ.visible ? moisAJour(form.mois, champ.choix) : "";

  // Les attributs min/max de l'input ne bloquent pas la saisie clavier :
  // le barème est validé à l'enregistrement (0 → maxNote) pour qu'aucune
  // note aberrante (ex. 99/20) ne corrompe moyennes et bulletins.
  const enregistrer = () => {
    if (!notePrete(form)) {
      avertir("Choisissez l'élève et la matière.");
      return;
    }
    const valeur = Number(form.note);
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > maxNote) {
      avertir(`Note invalide : saisissez une valeur entre 0 et ${maxNote}.`);
      return;
    }
    if (champ.visible && !mois) {
      avertir(t("gradeMonth.required"));
      return;
    }
    ajN({
      ...form,
      type,
      periode,
      mois: moisAEnregistrer({ type, section, periode, mois }),
      note: valeur,
      annee: annee || getAnnee(),
    });
    setModal(null);
  };

  return (
    <Modale titre="Saisir une note" fermer={() => setModal(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Selec label="Élève" value={form.eleveId || ""} onChange={e => {
            const el = eleves.find(ev => ev._id === e.target.value);
            setForm(p => ({ ...p, eleveId: el?._id || "", eleveNom: el ? nomEleve(el) : "" }));
          }}>
            <option value="">— Sélectionner —</option>
            {optionsEleves(eleves).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Selec>
        </div>
        <Selec label="Matière" value={form.matiere || ""} onChange={chg("matiere")}>
          <option value="">—</option>
          {matieresForClasse(eleveSelec?.classe).map(m => <option key={m._id}>{m.nom}</option>)}
        </Selec>
        <Selec label="Type" value={form.type || defaultNoteType} onChange={chg("type")}>
          {noteForms.map(item => <option key={item.id} value={item.value}>{item.label}</option>)}
        </Selec>
        <AvisFormeNote type={form.type || defaultNoteType} style={{ gridColumn: "1/-1" }} />
        <Input label={`Note (/${maxNote})`} type="number" min="0" max={maxNote} step="0.25" value={form.note || ""} onChange={chg("note")} />
        <Selec label="Période" value={periode} onChange={chg("periode")}>
          {periodes.map(p => <option key={p} value={p}>{p}</option>)}
        </Selec>
        {champ.visible && (
          <Selec label={t("gradeMonth.label")} value={mois} onChange={chg("mois")}>
            <option value="">{t("gradeMonth.choose")}</option>
            {champ.choix.map(m => <option key={m} value={m}>{libelleMoisCode(m)}</option>)}
          </Selec>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => setModal(null)}>Annuler</Btn>
        <Btn onClick={enregistrer}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
