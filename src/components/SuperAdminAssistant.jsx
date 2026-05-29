import { AssistantForm } from "./superadmin/AssistantForm";
import { AssistantResult } from "./superadmin/AssistantResult";
import { AssistantHistory } from "./superadmin/AssistantHistory";
import { useSuperadminAssistant } from "./superadmin/use-superadmin-assistant";

// Orchestrateur de l'assistant superadmin : la logique vit dans
// useSuperadminAssistant, chaque carte dans superadmin/Assistant*.jsx.
export default function SuperAdminAssistant() {
  const a = useSuperadminAssistant();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <AssistantForm
        mode={a.mode} setMode={a.setMode}
        schoolName={a.schoolName} setSchoolName={a.setSchoolName}
        context={a.context} setContext={a.setContext}
        prompt={a.prompt} setPrompt={a.setPrompt}
        error={a.error} loading={a.loading}
        applyPreset={a.applyPreset} clearForm={a.clearForm} generate={a.generate}
      />
      <AssistantResult result={a.result} modeLabel={a.modeLabel} />
      <AssistantHistory
        history={a.history}
        loadHistoryEntry={a.loadHistoryEntry}
        clearHistory={a.clearHistory}
      />
    </div>
  );
}
