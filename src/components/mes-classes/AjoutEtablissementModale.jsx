import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Btn, Champ, Input, Modale } from "../ui";
import { libelleSection } from "../../i18n/libelles";
import { NIVEAUX_ENSEIGNANT } from "../../inscription/inscription-validation";
import { ajouterEtablissement } from "../../backend/espaces-supabase";
import { erreurNouvelEtablissement } from "./mes-classes";

// Un enseignant indépendant ajoute un établissement où il enseigne aussi :
// un espace à part, relié au sien (Edge account-manage,
// ajouter_etablissement). Pas de mot de passe à choisir : il y entre depuis
// son espace, et se connecte toujours avec son numéro.
export function AjoutEtablissementModale({ fermer, onAjoute }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ etablissement: "", ville: "", sections: [] });
  const [erreur, setErreur] = useState("");
  const [enCours, setEnCours] = useState(false);

  const chg = (champ) => (e) => setForm((f) => ({ ...f, [champ]: e.target.value }));
  const basculer = (id) => setForm((f) => ({
    ...f, sections: f.sections.includes(id) ? f.sections.filter((s) => s !== id) : [...f.sections, id],
  }));

  const envoyer = async () => {
    const e = erreurNouvelEtablissement(form, t);
    if (e) { setErreur(e); return; }
    setEnCours(true);
    setErreur("");
    try {
      const nom = form.etablissement.trim();
      await ajouterEtablissement({ etablissement: nom, ville: form.ville.trim(), sections: form.sections });
      onAjoute(nom);
    } catch (err) {
      setErreur(err?.message || String(err));
      setEnCours(false);
    }
  };

  return (
    <Modale titre={`➕ ${t("shell.myClasses.add")}`} fermer={enCours ? () => {} : fermer}>
      <p style={{ fontSize: 12.5, color: "var(--lc-text-muted, #475569)", margin: "0 0 14px", lineHeight: 1.5 }}>
        {t("shell.myClasses.addHelp")}
      </p>
      <div style={{ display: "grid", gap: 12 }}>
        <Input label={t("shell.myClasses.schoolName")} aria-label={t("shell.myClasses.schoolName")}
          value={form.etablissement} onChange={chg("etablissement")} disabled={enCours}
          placeholder={t("register.teacher.schoolPlaceholder")} autoFocus />
        <Input label={t("register.city")} aria-label={t("register.city")}
          value={form.ville} onChange={chg("ville")} disabled={enCours}
          placeholder={t("register.teacher.cityPlaceholder")} />
        <Champ label={t("register.teacher.levels")}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {NIVEAUX_ENSEIGNANT.map((id) => {
              const coche = form.sections.includes(id);
              return (
                <label key={id} style={{
                  display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer",
                  border: `1.5px solid ${coche ? "#00A876" : "var(--lc-border, #b0c4d8)"}`,
                  background: coche ? "#ecfdf5" : "var(--lc-surface, #fff)",
                  borderRadius: 8, padding: "6px 10px", fontSize: 13, color: coche ? "#0A1628" : "var(--lc-text)",
                }}>
                  <input type="checkbox" checked={coche} onChange={() => basculer(id)} disabled={enCours} />
                  {libelleSection(id)}
                </label>
              );
            })}
          </div>
        </Champ>
      </div>
      {erreur && <p role="alert" style={{ color: "#b91c1c", fontSize: 12.5, margin: "12px 0 0" }}>{erreur}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
        <Btn v="ghost" onClick={fermer} disabled={enCours}>{t("common.cancel")}</Btn>
        <Btn onClick={envoyer} disabled={enCours}>
          {enCours ? t("shell.myClasses.adding") : `✅ ${t("shell.myClasses.submit")}`}
        </Btn>
      </div>
    </Modale>
  );
}
