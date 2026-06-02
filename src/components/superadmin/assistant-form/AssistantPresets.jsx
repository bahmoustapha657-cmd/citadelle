import { C } from "../../../constants";
import { SUPERADMIN_ASSISTANT_PRESETS } from "../../superadminAssistantConfig";
import { labelStyle } from "../assistant-styles";

// Grille de prompts prêts à l'emploi : un clic remplit le formulaire.
export function AssistantPresets({ applyPreset }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ ...labelStyle, marginBottom: 8 }}>Prompts prets a l'emploi</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 10 }}>
        {SUPERADMIN_ASSISTANT_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            style={{
              border: "1px solid #dbe4ef",
              borderRadius: 12,
              padding: "12px 14px",
              textAlign: "left",
              background: "#f8fbff",
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: C.blueDark }}>
              {preset.title}
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: "#6b7280", lineHeight: 1.5 }}>
              {preset.context}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
