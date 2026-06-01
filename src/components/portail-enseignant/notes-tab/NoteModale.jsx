import { Btn, Input, Modale, Selec } from "../../ui";

// Modale de création / édition d'une note unitaire.
export function NoteModale({
  modalNote, setModalNote, formNote, setFormNote,
  eleves, noteForms, defaultNoteType, periodeN, periodes,
  enregistrement, enregistrerNote,
}) {
  return (
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
        {periodes.map((p) => <option key={p}>{p}</option>)}
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
  );
}
