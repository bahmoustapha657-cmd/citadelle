import { useContext } from "react";
import { SchoolContext } from "../contexts/SchoolContext";
import { getAuthHeaders } from "../apiClient";

export function useIA() {
  const { schoolId } = useContext(SchoolContext);

  const genererCommentaire = async ({ eleve, moyenneGenerale, mention, matieres, periode, niveau }) => {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch("/api/ia", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "commentaire_bulletin",
        schoolId,
        payload: { eleve, moyenneGenerale, mention, matieres, periode, niveau },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erreur IA");
    }
    return (await res.json()).commentaire;
  };

  const genererDocument = async ({ type, eleve, contexte }) => {
    const headers = await getAuthHeaders({ "Content-Type": "application/json" });
    const res = await fetch("/api/ia", {
      method: "POST",
      headers,
      body: JSON.stringify({ action: "generer_document", schoolId, payload: { type, eleve, contexte } }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Erreur IA");
    }
    return (await res.json()).document;
  };

  return { genererCommentaire, genererDocument };
}
