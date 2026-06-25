import Logo from "../../Logo";
import { SEO_LINKS, ARTICLE_LINKS } from "./landing-content";

// Footer professionnel : marque + colonnes Produit / Ressources + barre légale.
export function LandingFooter({ onConnexion, onInscription, onDemo }) {
  return (
    <footer className="landing-footer">
      <div className="landing-footer-grid">
        <div>
          <Logo width={140} height={40} variant="light" />
          <p style={{ margin: "14px 0 0", fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, maxWidth: 320 }}>
            La plateforme tout-en-un des écoles privées d'Afrique de l'Ouest :
            élèves, notes, bulletins, comptabilité, emplois du temps et portails
            parents / enseignants.
          </p>
        </div>
        <div>
          <h4>Produit</h4>
          <button className="landing-footer-link" onClick={onInscription}>Créer mon école</button>
          <button className="landing-footer-link" onClick={onDemo}>Voir une démo</button>
          <a className="landing-footer-link" href="#tarifs">Tarifs</a>
          <button className="landing-footer-link" onClick={onConnexion}>Accéder à mon école</button>
        </div>
        <div>
          <h4>Ressources</h4>
          {SEO_LINKS.map((item) => (
            <a key={item.href} className="landing-footer-link" href={item.href}>{item.title}</a>
          ))}
          {ARTICLE_LINKS.map((item) => (
            <a key={item.href} className="landing-footer-link" href={item.href}>{item.title}</a>
          ))}
        </div>
        <div>
          <h4>Contact &amp; assistance</h4>
          <a className="landing-footer-link" href="tel:+224627738579">📞 +224 627 73 85 79</a>
          <a className="landing-footer-link" href="tel:+224662980896">📞 +224 662 98 08 96</a>
          <a className="landing-footer-link" href="https://wa.me/224627738579" target="_blank" rel="noreferrer">💬 WhatsApp</a>
          <a className="landing-footer-link" href="mailto:edugest26@gmail.com">✉️ edugest26@gmail.com</a>
        </div>
      </div>
      <div className="landing-footer-bottom">
        <span>© {new Date().getFullYear()} EduGest — Gestion scolaire moderne</span>
        <a className="landing-footer-link" href="/politique-confidentialite.html" style={{ display: "inline" }}>Politique de confidentialité</a>
        <span>FR · EN · AR — Web, tablette et mobile</span>
      </div>
    </footer>
  );
}
