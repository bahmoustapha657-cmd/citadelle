import { C } from "../../constants";
import { cardStyle } from "./assistant-styles";
import { AssistantModes } from "./assistant-form/AssistantModes";
import { AssistantPresets } from "./assistant-form/AssistantPresets";
import { AssistantSaisie } from "./assistant-form/AssistantSaisie";

export function AssistantForm({
  mode, setMode, schoolName, setSchoolName, context, setContext,
  prompt, setPrompt, error, loading, applyPreset, clearForm, generate,
}) {
  return (
    <div style={cardStyle}>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 900, color: C.blueDark }}>
          Assistant Superadmin
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
          Outil interne de redaction et d'analyse. Rien n'est publie automatiquement :
          tu gardes toujours la validation finale.
        </p>
      </div>

      <AssistantModes mode={mode} setMode={setMode}/>
      <AssistantPresets applyPreset={applyPreset}/>
      <AssistantSaisie
        schoolName={schoolName} setSchoolName={setSchoolName}
        context={context} setContext={setContext}
        prompt={prompt} setPrompt={setPrompt}
        error={error} loading={loading} clearForm={clearForm} generate={generate}
      />
    </div>
  );
}
