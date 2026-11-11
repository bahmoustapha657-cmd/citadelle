// Helpers de traduction des modules (label + desc).
// Fallback sur le champ FR du MODULES si la clé i18n manque.
// Une entrée qui porte `libelle` (menu du portail enseignant) est déjà
// traduite : elle ne passe pas par les clés `modules.*`.
export const moduleLabel = (m, t) => m.libelle ?? t(`modules.${m.id}.label`, m.label);
export const moduleDesc = (m, t) => (m.libelle !== undefined ? m.desc ?? "" : t(`modules.${m.id}.desc`, m.desc));
