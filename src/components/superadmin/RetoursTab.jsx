import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { C } from "../../constants";
import { GENRES, REPONSE_MAX, STATUTS, compterNouveaux, filtrerRetours, genreDe, resumeContexte } from "../../retours-terrain";
import { tousLesRetours, traiterRetour } from "../../backend/retours-terrain-supabase";
import { localeCourante } from "../../i18n";

const COULEURS_STATUT = {
  nouveau: { background: "#fef3c7", color: "#92400e" },
  lu: { background: "#dbeafe", color: "#1e40af" },
  traite: { background: "#d1fae5", color: "#065f46" },
};
const dateHeure = (ms) => (ms ? new Date(ms).toLocaleString(localeCourante(), { dateStyle: "medium", timeStyle: "short" }) : "");

// Un retour : message, contexte joint, statut et réponse (vue par l'auteur
// dans son centre d'aide).
function RetourCarte({ retour, S, onMaj }) {
  const { t } = useTranslation();
  const [statut, setStatut] = useState(retour.statut);
  const [reponse, setReponse] = useState(retour.reponse);
  const [enCours, setEnCours] = useState(false);
  const [etat, setEtat] = useState(""); // "", "ok", "erreur"
  const modifie = statut !== retour.statut || reponse.trim() !== retour.reponse.trim();
  const g = genreDe(retour.genre);

  const enregistrer = async () => {
    setEnCours(true); setEtat("");
    try {
      // Répondre sans changer le statut d'un retour neuf = il est traité.
      const statutFinal = statut === "nouveau" && reponse.trim() && !retour.reponse ? "traite" : statut;
      const maj = await traiterRetour(retour, { statut: statutFinal, reponse });
      setStatut(maj.statut); setReponse(maj.reponse);
      onMaj(maj); setEtat("ok");
    } catch {
      setEtat("erreur");
    } finally {
      setEnCours(false);
    }
  };

  const contexte = resumeContexte(retour.contexte);
  return (
    <div data-testid="retour-terrain" style={{ ...S.card, padding: "14px 18px", marginBottom: 12, borderInlineStart: `4px solid ${COULEURS_STATUT[retour.statut]?.color || "#9ca3af"}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
        <strong style={{ fontSize: 13, color: C.blueDark }}>{g ? `${g.icone} ${t(`feedback.genres.${g.id}`)}` : retour.genre}</strong>
        <span style={{ ...S.badge(true), ...COULEURS_STATUT[retour.statut] }}>{t(`feedback.statuts.${retour.statut}`)}</span>
        <span><strong style={{ color: "#374151" }}>{retour.ecoleNom || retour.ecoleCode || "—"}</strong>{retour.ecoleCode ? ` (${retour.ecoleCode})` : ""}</span>
        <span>{retour.auteur}{retour.role ? ` · ${retour.role}` : ""}</span>
        <span style={{ marginInlineStart: "auto" }}>{dateHeure(retour.createdAt)}</span>
      </div>
      <p style={{ margin: "0 0 8px", fontSize: 14, color: "#1f2937", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{retour.message}</p>
      {contexte && <p style={{ margin: "0 0 10px", fontSize: 11, color: "#9ca3af" }}>{t("feedback.admin.context")} : {contexte}</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
        <select aria-label={t("feedback.admin.status")} value={statut} onChange={(e) => setStatut(e.target.value)} style={{ ...S.input, padding: "7px 10px" }}>
          {STATUTS.map((s) => <option key={s} value={s}>{t(`feedback.statuts.${s}`)}</option>)}
        </select>
        <textarea aria-label={t("feedback.admin.reply")} value={reponse} maxLength={REPONSE_MAX} rows={2}
          onChange={(e) => { setReponse(e.target.value); setEtat(""); }}
          placeholder={t("feedback.admin.replyPlaceholder")}
          style={{ ...S.input, flex: "1 1 260px", minHeight: 40, resize: "vertical", fontFamily: "inherit" }} />
        <button type="button" onClick={enregistrer} disabled={!modifie || enCours}
          style={{ ...S.btn(C.blue), padding: "8px 14px", opacity: !modifie || enCours ? 0.5 : 1, cursor: !modifie || enCours ? "not-allowed" : "pointer" }}>
          {enCours ? t("feedback.admin.saving") : t("common.save")}
        </button>
      </div>
      {etat === "ok" && <p role="status" style={{ margin: "6px 0 0", fontSize: 12, color: "#065f46", fontWeight: 700 }}>{t("feedback.admin.saved")}</p>}
      {etat === "erreur" && <p role="alert" style={{ margin: "6px 0 0", fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>{t("feedback.admin.saveError")}</p>}
      {retour.reponduLe > 0 && <p style={{ margin: "6px 0 0", fontSize: 11, color: "#9ca3af" }}>{t("feedback.admin.repliedOn", { date: dateHeure(retour.reponduLe) })}</p>}
    </div>
  );
}

// Onglet « Retours terrain » du Panel Super-Admin : ce que les écoles
// signalent depuis leur centre d'aide (problèmes, idées, questions, bravos),
// avec filtre, statut et réponse. `onNouveaux` tient le compteur de l'onglet.
export function RetoursTab({ S, onNouveaux }) {
  const { t } = useTranslation();
  const [retours, setRetours] = useState(null);
  const [erreur, setErreur] = useState(false);
  // Tous les statuts par défaut : un retour auquel on vient de répondre
  // (« traité ») ne disparaît pas sous les yeux. Le compteur de l'onglet
  // et la bordure de couleur signalent les nouveaux.
  const [filtre, setFiltre] = useState({ statut: "", genre: "", q: "" });

  const charger = useCallback(() => tousLesRetours()
    .then((l) => { setRetours(l); setErreur(false); })
    .catch(() => { setRetours((avant) => avant || []); setErreur(true); }), []);
  useEffect(() => { charger(); }, [charger]);
  useEffect(() => { if (retours) onNouveaux?.(compterNouveaux(retours)); }, [retours, onNouveaux]);

  const maj = (r) => setRetours((liste) => liste.map((x) => (x._id === r._id ? r : x)));

  const visibles = useMemo(() => filtrerRetours(retours || [], filtre), [retours, filtre]);
  const parStatut = (s) => (retours || []).filter((r) => r.statut === s).length;

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>{t("feedback.admin.intro")}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
        <select aria-label={t("feedback.admin.filterStatus")} value={filtre.statut} onChange={(e) => setFiltre({ ...filtre, statut: e.target.value })} style={S.input}>
          <option value="">{t("feedback.admin.allStatuses", { n: (retours || []).length })}</option>
          {STATUTS.map((s) => <option key={s} value={s}>{t(`feedback.statuts.${s}`)} ({parStatut(s)})</option>)}
        </select>
        <select aria-label={t("feedback.admin.filterGenre")} value={filtre.genre} onChange={(e) => setFiltre({ ...filtre, genre: e.target.value })} style={S.input}>
          <option value="">{t("feedback.admin.allGenres")}</option>
          {GENRES.map((g) => <option key={g.id} value={g.id}>{g.icone} {t(`feedback.genres.${g.id}`)}</option>)}
        </select>
        <input type="search" value={filtre.q} onChange={(e) => setFiltre({ ...filtre, q: e.target.value })}
          placeholder={t("feedback.admin.search")} style={{ ...S.input, flex: "1 1 220px" }} />
        <button type="button" onClick={charger} style={{ ...S.btn(C.blue), padding: "8px 14px" }}>{t("feedback.admin.refresh")}</button>
      </div>

      {erreur && <p role="alert" style={{ fontSize: 13, color: "#b91c1c", fontWeight: 600 }}>{t("feedback.admin.loadError")}</p>}
      {retours === null && <p style={{ fontSize: 13, color: "#9ca3af" }}>{t("common.loading")}</p>}
      {retours && visibles.length === 0 && (
        <div style={{ ...S.card, padding: 40, textAlign: "center", color: "#9ca3af" }}>{t("feedback.admin.empty")}</div>
      )}
      {visibles.map((r) => <RetourCarte key={r._id} retour={r} S={S} onMaj={maj} />)}
    </div>
  );
}
