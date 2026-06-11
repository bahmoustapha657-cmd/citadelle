import { getAnnee } from "../../../constants";
import { Btn, Input, Modale, Selec } from "../../ui";
import { resolveCanonicalNoteType } from "../../../evaluation-forms";

// Modale de saisie d'une note unique.
export function AjoutNoteModal({
  form, setForm, setModal,
  eleves, matieresForClasse, noteForms, defaultNoteType, maxNote,
  schoolInfo, isPrimarySection, periodes, annee, ajN, toast,
}) {
  const chg = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  // Les attributs min/max de l'input ne bloquent pas la saisie clavier :
  // le barème est validé à l'enregistrement (0 → maxNote) pour qu'aucune
  // note aberrante (ex. 99/20) ne corrompe moyennes et bulletins.
  const enregistrer = () => {
    const valeur = Number(form.note);
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > maxNote) {
      const msg = `Note invalide : saisissez une valeur entre 0 et ${maxNote}.`;
      if (toast) toast(msg, "warning"); else alert(msg);
      return;
    }
    ajN({
      ...form,
      type: resolveCanonicalNoteType(form.type, schoolInfo, isPrimarySection ? "primaire" : "secondaire"),
      note: valeur,
      annee: annee || getAnnee(),
    });
    setModal(null);
  };

  return (
    <Modale titre="Saisir une note" fermer={() => setModal(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}>
          <Selec label="Élève" value={form.eleveNom || ""} onChange={e => {
            const el = eleves.find(ev => `${ev.nom} ${ev.prenom}` === e.target.value);
            setForm(p => ({ ...p, eleveNom: e.target.value, eleveId: el?._id }));
          }}>
            <option value="">— Sélectionner —</option>
            {eleves.map(e => <option key={e._id}>{e.nom} {e.prenom}</option>)}
          </Selec>
        </div>
        <Selec label="Matière" value={form.matiere || ""} onChange={chg("matiere")}>
          <option value="">—</option>
          {(() => {
            const eleveSelec = eleves.find(e => `${e.nom} ${e.prenom}` === form.eleveNom);
            return matieresForClasse(eleveSelec?.classe).map(m => <option key={m._id}>{m.nom}</option>);
          })()}
        </Selec>
        <Selec label="Type" value={form.type || defaultNoteType} onChange={chg("type")}>
          {noteForms.map(item => <option key={item.id} value={item.value}>{item.label}</option>)}
        </Selec>
        <Input label={`Note (/${maxNote})`} type="number" min="0" max={maxNote} step="0.25" value={form.note || ""} onChange={chg("note")} />
        <Selec label="Période" value={form.periode || periodes[0] || "T1"} onChange={chg("periode")}>
          {periodes.map(p => <option key={p} value={p}>{p}</option>)}
        </Selec>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => setModal(null)}>Annuler</Btn>
        <Btn onClick={enregistrer}>Enregistrer</Btn>
      </div>
    </Modale>
  );
}
