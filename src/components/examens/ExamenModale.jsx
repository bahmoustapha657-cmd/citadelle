import { Btn, Input, Modale, Selec, Textarea } from "../ui";

// Modale de planification / modification d'un examen.
export function ExamenModale({ modal, setModal, form, chg, examForms, defaultExamType, classes, saveExam }) {
  return (
    <Modale titre={modal === "add" ? "Planifier un examen" : "Modifier l'examen"} fermer={() => setModal(null)}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1/-1" }}><Input label="Titre de l'examen" value={form.titre || ""} onChange={chg("titre")} placeholder="Ex : Composition du 1er trimestre" /></div>
        <Selec label="Type" value={form.type || defaultExamType} onChange={chg("type")}>
          {examForms.map(item => <option key={item.id} value={item.value}>{item.label}</option>)}
        </Selec>
        <Selec label="Classe" value={form.classe || "Toutes"} onChange={chg("classe")}>
          <option>Toutes</option>
          {classes.map(c => <option key={c}>{c}</option>)}
        </Selec>
        <Input label="Date" type="date" value={form.date || ""} onChange={chg("date")} />
        <Input label="Heure de début" value={form.heure || ""} onChange={chg("heure")} placeholder="08:00" />
        <Input label="Salle / Lieu" value={form.salle || ""} onChange={chg("salle")} placeholder="Salle A" />
        <Input label="Matière (optionnel)" value={form.matiere || ""} onChange={chg("matiere")} />
        <Input label="Durée" value={form.duree || ""} onChange={chg("duree")} placeholder="2h" />
        <div style={{ gridColumn: "1/-1" }}><Textarea label="Consignes (optionnel)" value={form.consignes || ""} onChange={chg("consignes")} /></div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
        <Btn v="ghost" onClick={() => setModal(null)}>Annuler</Btn>
        <Btn onClick={saveExam}>{modal === "add" ? "Planifier" : "Enregistrer"}</Btn>
      </div>
    </Modale>
  );
}
