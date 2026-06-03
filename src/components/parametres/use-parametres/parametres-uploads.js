// Lecture d'un fichier image en data URL base64 (promesse).
// Mutualise le FileReader des uploads logo / galerie / bannière.
export function lireImageEnBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
