// Traduit une erreur d'accès caméra en message lisible pour l'utilisateur.
export function getCameraErrorMessage(e) {
  const detail = e?.message || e?.name || "Erreur inconnue";
  if (!window.isSecureContext) {
    return "Caméra indisponible : la caméra ne fonctionne que sur une page sécurisée (https).";
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    return "Caméra indisponible : votre navigateur ou votre appareil ne prend pas en charge l'accès caméra.";
  }
  if (e?.name === "NotAllowedError" || e?.name === "PermissionDeniedError") {
    return "Caméra indisponible : l'accès a été refusé. Autorisez la caméra dans le navigateur puis réessayez.";
  }
  if (e?.name === "NotFoundError" || e?.name === "DevicesNotFoundError") {
    return "Caméra indisponible : aucune caméra détectée sur cet appareil.";
  }
  if (e?.name === "NotReadableError" || e?.name === "TrackStartError") {
    return "Caméra indisponible : la caméra est peut-être déjà utilisée par une autre application.";
  }
  return "Caméra indisponible : " + detail;
}
