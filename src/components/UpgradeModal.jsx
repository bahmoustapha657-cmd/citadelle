import { S } from "./upgrade-modal/upgrade-styles";
import { useUpgradeModal } from "./upgrade-modal/use-upgrade-modal";
import { EtapeChoix } from "./upgrade-modal/EtapeChoix";
import { EtapeInstructions } from "./upgrade-modal/EtapeInstructions";
import { EtapeSoumission } from "./upgrade-modal/EtapeSoumission";
import { EtapeAttente } from "./upgrade-modal/EtapeAttente";
import { EtapeSucces } from "./upgrade-modal/EtapeSucces";

// Modale d'upgrade vers le Plan Pro : aiguille entre les 5 étapes.
export default function UpgradeModal({ onFermer }) {
  const u = useUpgradeModal();

  return (
    <div style={S.overlay} onClick={onFermer}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {u.etape === "choix" && (
          <EtapeChoix schoolInfo={u.schoolInfo} setEtape={u.setEtape} onFermer={onFermer} />
        )}
        {u.etape === "instructions" && <EtapeInstructions setEtape={u.setEtape} />}
        {u.etape === "soumission" && (
          <EtapeSoumission
            form={u.form} setForm={u.setForm} chg={u.chg} erreur={u.erreur}
            chargement={u.chargement} soumettreDemande={u.soumettreDemande} setEtape={u.setEtape}
          />
        )}
        {u.etape === "attente" && <EtapeAttente onFermer={onFermer} />}
        {u.etape === "succes" && <EtapeSucces schoolInfo={u.schoolInfo} onFermer={onFermer} />}
      </div>
    </div>
  );
}
