import { preparerEcole } from "./donnees.js";

export default async function globalSetup() {
  const id = await preparerEcole();
  console.log(`[e2e] école de test prête (${id})`);
}
