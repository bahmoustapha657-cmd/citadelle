import { computeDateExpiration, formatDateFR } from "../../../legal-utils";
import { L_STYLE, I_STYLE } from "./legal-styles";
import { Section } from "./legal-fields-ui";

// Toutes les sections de saisie des informations légales.
export function LegalEditFields({ draft, set, setNum }) {
  return (
    <>
      <Section title="Promoteur">
        <div><label style={L_STYLE}>Nom</label><input style={I_STYLE} value={draft.promoteur.nom} onChange={set("promoteur.nom")} /></div>
        <div><label style={L_STYLE}>Année de naissance</label><input style={I_STYLE} type="number" value={draft.promoteur.anneeNaissance} onChange={setNum("promoteur.anneeNaissance")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Lieu de naissance</label><input style={I_STYLE} value={draft.promoteur.lieuNaissance} onChange={set("promoteur.lieuNaissance")} /></div>
      </Section>

      <Section title="Autorisation de création (travaux)">
        <div><label style={L_STYLE}>Numéro</label><input style={I_STYLE} value={draft.autorisationCreation.numero} onChange={set("autorisationCreation.numero")} /></div>
        <div><label style={L_STYLE}>Date de signature</label><input style={I_STYLE} type="date" value={draft.autorisationCreation.dateSignature} onChange={set("autorisationCreation.dateSignature")} /></div>
        <div><label style={L_STYLE}>Ministre signataire</label><input style={I_STYLE} value={draft.autorisationCreation.ministre} onChange={set("autorisationCreation.ministre")} /></div>
        <div><label style={L_STYLE}>Ministère</label><input style={I_STYLE} value={draft.autorisationCreation.ministere} onChange={set("autorisationCreation.ministere")} /></div>
      </Section>

      <Section title="Arrêté d'ouverture (agrément)">
        <div><label style={L_STYLE}>Numéro</label><input style={I_STYLE} value={draft.arreteOuverture.numero} onChange={set("arreteOuverture.numero")} /></div>
        <div><label style={L_STYLE}>Date de signature</label><input style={I_STYLE} type="date" value={draft.arreteOuverture.dateSignature} onChange={set("arreteOuverture.dateSignature")} /></div>
        <div><label style={L_STYLE}>Ministre signataire</label><input style={I_STYLE} value={draft.arreteOuverture.ministre} onChange={set("arreteOuverture.ministre")} /></div>
        <div><label style={L_STYLE}>Ministère</label><input style={I_STYLE} value={draft.arreteOuverture.ministere} onChange={set("arreteOuverture.ministere")} /></div>
        <div><label style={L_STYLE}>Validité (années)</label><input style={I_STYLE} type="number" value={draft.arreteOuverture.dureeValiditeAnnees} onChange={setNum("arreteOuverture.dureeValiditeAnnees")} /></div>
        <div><label style={L_STYLE}>Expiration (calculée)</label><input style={{ ...I_STYLE, background: "#f1f5f9", color: "#475569" }} value={formatDateFR(computeDateExpiration(draft))} readOnly /></div>
      </Section>

      <Section title="Codes statistiques officiels">
        <div><label style={L_STYLE}>Maternelle</label><input style={I_STYLE} value={draft.codesStatistiques.maternelle} onChange={set("codesStatistiques.maternelle")} /></div>
        <div><label style={L_STYLE}>Primaire</label><input style={I_STYLE} value={draft.codesStatistiques.primaire} onChange={set("codesStatistiques.primaire")} /></div>
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Secondaire</label><input style={I_STYLE} value={draft.codesStatistiques.secondaire} onChange={set("codesStatistiques.secondaire")} /></div>
      </Section>

      <Section title="Identité & localisation">
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Dénomination</label><input style={I_STYLE} value={draft.etablissement.denomination} onChange={set("etablissement.denomination")} /></div>
        <div><label style={L_STYLE}>Quartier</label><input style={I_STYLE} value={draft.etablissement.quartier} onChange={set("etablissement.quartier")} /></div>
        <div><label style={L_STYLE}>Commune</label><input style={I_STYLE} value={draft.etablissement.commune} onChange={set("etablissement.commune")} /></div>
        <div><label style={L_STYLE}>Région</label><input style={I_STYLE} value={draft.etablissement.region} onChange={set("etablissement.region")} /></div>
        <div><label style={L_STYLE}>Email</label><input style={I_STYLE} type="email" value={draft.etablissement.email} onChange={set("etablissement.email")} /></div>
      </Section>

      <Section title="Tutelle administrative">
        <div style={{ gridColumn: "1 / -1" }}><label style={L_STYLE}>Ministère de tutelle</label><input style={I_STYLE} value={draft.etablissement.ministereTutelle || ""} onChange={set("etablissement.ministereTutelle")} placeholder="Ex. : Ministère de l'Enseignement Pré-Universitaire et de l'Éducation Civique" /></div>
        <div><label style={L_STYLE}>Inspection Régionale (IRE)</label><input style={I_STYLE} value={draft.etablissement.ire || ""} onChange={set("etablissement.ire")} placeholder="Ex. : IRE de Kindia" /></div>
        <div><label style={L_STYLE}>Direction Préfectorale (DPE)</label><input style={I_STYLE} value={draft.etablissement.dpe || ""} onChange={set("etablissement.dpe")} placeholder="Ex. : DPE de Kindia" /></div>
      </Section>
    </>
  );
}
