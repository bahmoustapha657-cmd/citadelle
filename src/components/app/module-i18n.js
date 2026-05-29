// Helpers de traduction des modules (label + desc).
// Fallback sur le champ FR du MODULES si la clé i18n manque.
export const moduleLabel = (m, t) => t(`modules.${m.id}.label`, m.label);
export const moduleDesc = (m, t) => t(`modules.${m.id}.desc`, m.desc);
