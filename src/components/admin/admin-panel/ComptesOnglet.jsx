import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../../constants";
import { Btn, Card } from "../../ui";
import { ComptesTable } from "./ComptesTable";
import { TYPES_COMPTE, compterParType, filtrerComptes } from "./comptes-filtre";

const puce = (actif) => ({
  padding: "6px 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, cursor: "pointer",
  border: `1.5px solid ${actif ? C.blue : "var(--lc-border, #e2e8f0)"}`,
  background: actif ? C.blue : "var(--lc-surface, #fff)", color: actif ? "#fff" : "var(--lc-text, #1f2937)",
});

// Onglet « 👥 Comptes » : tous les comptes de l'école, qui est connecté, et
// la réinitialisation d'un mot de passe. Personnel affiché d'office : c'est
// lui qu'on cherche ici, les parents se comptent par centaines.
export function ComptesOnglet({ comptes, chargement, initEnCours, peutResetCompte, setForm, setModal, allerAuxPostes }) {
  const { t } = useTranslation();
  const libelles = {
    personnel: t("comptesPostes.comptes.types.personnel"), enseignant: t("comptesPostes.comptes.types.enseignant"),
    parent: t("comptesPostes.comptes.types.parent"), tous: t("comptesPostes.comptes.types.tous"),
  };
  const [type, setType] = useState("personnel");
  const [recherche, setRecherche] = useState("");
  const nombres = useMemo(() => compterParType(comptes), [comptes]);
  const visibles = useMemo(() => filtrerComptes(comptes, { type, recherche }), [comptes, type, recherche]);
  // Rien dans ce type, mais la recherche trouve ailleurs : on le dit.
  const ailleurs = useMemo(() => (visibles.length === 0 && recherche.trim() && type !== "tous"
    ? filtrerComptes(comptes, { recherche }).length : 0), [comptes, visibles, recherche, type]);
  const puces = [...TYPES_COMPTE.filter((id) => nombres[id] > 0 || id === type), "tous"];

  return (
    <>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        {t("comptesPostes.comptes.intro")} {t("comptesPostes.comptes.introPostes")}{" "}
        <Btn sm v="ghost" onClick={allerAuxPostes}>{t("comptesPostes.onglets.postes")}</Btn>
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <input value={recherche} onChange={(e) => setRecherche(e.target.value)} type="search"
          placeholder={t("comptesPostes.comptes.recherche")} aria-label={t("comptesPostes.comptes.rechercheAria")}
          style={{ flex: 1, minWidth: 220, maxWidth: 380, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #cbd5e1", fontSize: 13 }} />
        {puces.map((id) => (
          <button key={id} type="button" style={puce(type === id)} aria-pressed={type === id} onClick={() => setType(id)}>
            {libelles[id]} ({nombres[id]})
          </button>
        ))}
      </div>
      {!chargement && !initEnCours && visibles.length === 0 ? (
        <Card style={{ padding: "18px 20px", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: 13, color: "#64748b" }}>{t("comptesPostes.comptes.aucun")}</p>
          {ailleurs > 0 && (
            <div style={{ marginTop: 10 }}>
              <Btn sm v="ghost" onClick={() => setType("tous")}>{t("comptesPostes.comptes.chercherPartout", { n: ailleurs })}</Btn>
            </div>
          )}
        </Card>
      ) : (
        <ComptesTable
          comptes={visibles} chargement={chargement} initEnCours={initEnCours}
          peutResetCompte={peutResetCompte} setForm={setForm} setModal={setModal}
        />
      )}
    </>
  );
}
