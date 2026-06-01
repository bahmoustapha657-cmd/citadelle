import { useEnseignantsTab } from "./enseignants-tab/use-enseignants-tab";
import { EnseignantsListe } from "./enseignants-tab/EnseignantsListe";
import { EnseignantModale } from "./enseignants-tab/EnseignantModale";

export function EnseignantsTab(props) {
  const { form, setForm, modal, setModal, canCreate, canEdit, ensPrimaire, ensCollege, ensLycee } = props;
  const { chg, ensTous, supEnsForSection, saveEns } = useEnseignantsTab(props);
  return (
    <div>
      <EnseignantsListe
        ensTous={ensTous} ensPrimaire={ensPrimaire} ensCollege={ensCollege} ensLycee={ensLycee}
        canCreate={canCreate} canEdit={canEdit} setForm={setForm} setModal={setModal} supEnsForSection={supEnsForSection}
      />
      <EnseignantModale
        form={form} setForm={setForm} modal={modal} setModal={setModal}
        canCreate={canCreate} canEdit={canEdit} chg={chg} saveEns={saveEns}
      />
    </div>
  );
}
