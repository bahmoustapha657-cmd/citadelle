// ══════════════════════════════════════════════════════════════
//  Séances de cours (logique pure) — appel par cours au secondaire
// ══════════════════════════════════════════════════════════════
// Au secondaire, plusieurs professeurs entrent dans la même classe le même
// jour : chacun fait l'appel de SON cours. Une absence porte alors l'heure du
// cours (heureDebut, heureFin : « 08:00 ») ; sans heure, elle vaut pour toute
// la journée (primaire, direction, absences d'avant l'appel par cours).
// Les cours d'une classe viennent de l'emploi du temps (créneaux `emplois` :
// classe, jour « Lundi », heureDebut, heureFin, matiere, enseignant).
import { JOURS_SEMAINE } from "../../constants.js";

export const sectionParCours = (section = "") => ["college", "lycee", "secondaire"].includes(String(section).toLowerCase());

const HEURE = /^(\d{1,2}):(\d{2})/;
export function enMinutes(heure) {
  const m = HEURE.exec(String(heure || "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const deux = (n) => String(n).padStart(2, "0");
export const heureDe = (minutes) => `${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}`;
// « 8:00 » et « 08:00 » sont la même heure.
export const normaliserHeure = (heure) => {
  const m = enMinutes(heure);
  return m == null ? "" : heureDe(m);
};

// Une séance a ses deux heures, dans l'ordre ; sinon ce n'est pas une séance.
export function seanceValide(seance) {
  const debut = enMinutes(seance?.heureDebut);
  const fin = enMinutes(seance?.heureFin);
  return debut != null && fin != null && fin > debut;
}
export const cleSeance = (seance) => (seanceValide(seance)
  ? `${normaliserHeure(seance.heureDebut)}-${normaliserHeure(seance.heureFin)}` : "");
export const libelleSeance = (seance) => (seanceValide(seance)
  ? `${normaliserHeure(seance.heureDebut)}–${normaliserHeure(seance.heureFin)}` : "");
export const dureeMinutes = (seance) => (seanceValide(seance)
  ? enMinutes(seance.heureFin) - enMinutes(seance.heureDebut) : 0);

// « Lundi » … « Samedi » d'une date ISO ; "" le dimanche.
export function jourDeLaSemaine(date) {
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00`);
  const n = d.getDay();
  return Number.isNaN(n) || n === 0 ? "" : JOURS_SEMAINE[n - 1] || "";
}

const meme = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

// Cours d'une classe un jour donné, dans l'ordre de la journée ; un même
// créneau saisi deux fois ne compte qu'une fois. `classe` vide : créneaux
// déjà ceux d'une classe.
export function seancesDuJour(emplois = [], classe = "", date = "") {
  const jour = jourDeLaSemaine(date);
  if (!jour) return [];
  const vus = new Map();
  for (const e of emplois) {
    if ((classe && !meme(e.classe, classe)) || !meme(e.jour, jour) || !seanceValide(e)) continue;
    const cle = cleSeance(e);
    if (!vus.has(cle)) {
      vus.set(cle, {
        heureDebut: normaliserHeure(e.heureDebut), heureFin: normaliserHeure(e.heureFin),
        matiere: e.matiere || "", enseignant: e.enseignant || "",
      });
    }
  }
  return [...vus.values()].sort((a, b) => enMinutes(a.heureDebut) - enMinutes(b.heureDebut));
}

// Cours proposé d'office : celui en cours à `maintenant` (« HH:MM »), sinon le
// dernier commencé (appel fait juste après), sinon le premier de la journée.
export function seanceParDefaut(seances = [], maintenant = "") {
  if (!seances.length) return null;
  const t = enMinutes(maintenant);
  if (t == null) return seances[0];
  const enCours = seances.find((s) => enMinutes(s.heureDebut) <= t && t < enMinutes(s.heureFin));
  if (enCours) return enCours;
  const commences = seances.filter((s) => enMinutes(s.heureDebut) <= t);
  return commences.at(-1) || seances[0];
}

// Minutes communes à deux plages horaires.
export function recouvrement(a, b) {
  if (!seanceValide(a) || !seanceValide(b)) return 0;
  return Math.max(0, Math.min(enMinutes(a.heureFin), enMinutes(b.heureFin))
    - Math.max(enMinutes(a.heureDebut), enMinutes(b.heureDebut)));
}
