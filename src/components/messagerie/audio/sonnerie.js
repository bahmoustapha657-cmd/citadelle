// ── Sonneries synthétisées (Web Audio) : aucun fichier à télécharger ────────
// « entrant » : double bip répété (+ vibration sur téléphone) ;
// « sortant » : tonalité de retour d'appel (425 Hz, 1 s sur 4 s).

export function creerSonnerie(type = "entrant") {
  let ctx = null;
  let minuteur = null;
  let actif = false;

  const bip = (debut, duree, frequence, volume = 0.12) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = frequence;
    gain.gain.setValueAtTime(0, debut);
    gain.gain.linearRampToValueAtTime(volume, debut + 0.02);
    gain.gain.setValueAtTime(volume, debut + duree - 0.03);
    gain.gain.linearRampToValueAtTime(0, debut + duree);
    osc.connect(gain).connect(ctx.destination);
    osc.start(debut);
    osc.stop(debut + duree);
  };

  const motif = () => {
    if (!actif || !ctx) return;
    const t = ctx.currentTime + 0.05;
    if (type === "entrant") {
      bip(t, 0.35, 880);
      bip(t + 0.45, 0.35, 660);
      try { navigator.vibrate?.([300, 150, 300]); } catch { /* sans vibreur */ }
    } else {
      bip(t, 1, 425, 0.06);
    }
  };

  return {
    demarrer() {
      if (actif) return;
      actif = true;
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        ctx = new Ctx();
        ctx.resume?.().catch(() => {});
        motif();
        minuteur = setInterval(motif, type === "entrant" ? 2500 : 4000);
      } catch { /* son indisponible : l'écran d'appel suffit */ }
    },
    arreter() {
      actif = false;
      clearInterval(minuteur);
      minuteur = null;
      try { navigator.vibrate?.(0); } catch { /* sans vibreur */ }
      ctx?.close?.().catch(() => {});
      ctx = null;
    },
  };
}
