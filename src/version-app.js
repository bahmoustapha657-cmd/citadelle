// Version de l'app, figée au build par vite.config.js (define
// __EDUGEST_VERSION__, cf. scripts/version-build.mjs). Hors Vite (tests sous
// tsx), la constante n'existe pas : valeur de repli.
/* global __EDUGEST_VERSION__ */
export const VERSION_APP =
  typeof __EDUGEST_VERSION__ !== "undefined"
    ? __EDUGEST_VERSION__
    : { commit: "dev", court: "dev", branche: "", propre: true, date: "" };
