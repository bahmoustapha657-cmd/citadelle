// Aucun élève sans classe. L'écran l'exige ; ici, la base elle-même, seule à
// couvrir une version de l'application encore en cache.
import { test, expect } from "@playwright/test";
import { ELEVES, SECTION, clientAdmin, ecoleId } from "../donnees.js";

test("la base refuse d'inscrire un élève sans classe", async () => {
  const admin = clientAdmin();
  const ecole_id = await ecoleId(admin);
  for (const classe of [undefined, "", "   "]) {
    const { error } = await admin.from("eleves")
      .insert({ ecole_id, section: SECTION, nom: "SANS", prenom: "Classe", classe });
    expect(error?.code).toBe("23514");
    expect(error?.message).toContain("Classe obligatoire");
  }
});

test("une fiche ne peut pas perdre sa classe", async () => {
  const admin = clientAdmin();
  const { error } = await admin.from("eleves").update({ classe: "" })
    .eq("ecole_id", await ecoleId(admin)).eq("matricule", ELEVES[0].matricule);
  expect(error?.code).toBe("23514");
});
