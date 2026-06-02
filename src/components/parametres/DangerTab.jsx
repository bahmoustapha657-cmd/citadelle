import { DangerActions } from "./danger-tab/DangerActions";
import { DangerConfirmation } from "./danger-tab/DangerConfirmation";

// Onglet "Danger" de ParametresEcole.
// Désactivation / suppression logique de l'école — réservé direction.
// Le parent gère l'état dangerAction/dangerConfirmation et la requête
// API ; cet onglet n'est qu'une présentation des actions disponibles.
export function DangerTab({
  dangerConfig,
  dangerAction,
  setDangerAction,
  dangerConfirmation,
  setDangerConfirmation,
  dangerLoading,
  lancerActionEcole,
  setErreur,
  setMsgSucces,
  schoolInfo,
  schoolId,
  inp,
  sec,
}) {
  return (
    <>
      <DangerActions
        dangerConfig={dangerConfig} setDangerAction={setDangerAction}
        setDangerConfirmation={setDangerConfirmation} setErreur={setErreur}
        setMsgSucces={setMsgSucces} sec={sec}
      />
      <DangerConfirmation
        dangerConfig={dangerConfig} dangerAction={dangerAction} setDangerAction={setDangerAction}
        dangerConfirmation={dangerConfirmation} setDangerConfirmation={setDangerConfirmation}
        dangerLoading={dangerLoading} lancerActionEcole={lancerActionEcole}
        schoolInfo={schoolInfo} schoolId={schoolId} inp={inp} sec={sec}
      />
    </>
  );
}
