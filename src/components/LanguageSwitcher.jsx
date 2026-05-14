import React from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LANGS } from "../i18n";

export function LanguageSwitcher({ compact = false, style = {} }) {
  const { i18n, t } = useTranslation();
  const current = i18n.resolvedLanguage || i18n.language || "fr";
  return (
    <select
      aria-label={t("common.language")}
      value={current}
      onChange={(e) => i18n.changeLanguage(e.target.value)}
      style={{
        padding: compact ? "4px 8px" : "6px 10px",
        borderRadius: 8,
        border: "1px solid #cbd5e1",
        fontSize: compact ? 12 : 13,
        fontWeight: 600,
        background: "#fff",
        color: "#0f172a",
        cursor: "pointer",
        ...style,
      }}
    >
      {SUPPORTED_LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.label}
        </option>
      ))}
    </select>
  );
}

export default LanguageSwitcher;
