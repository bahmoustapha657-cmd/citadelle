import { useState } from "react";
import { useTranslation } from "react-i18next";
import { InstallBanner } from "../app/InstallBanner";
import { GuideIphone } from "./GuideIphone";
import { invitationInstallationVisible, masquerInvitationInstallation } from "./iphone";

// iPhone ou iPad, EduGest ouvert dans Safari : invitation à l'installer sur
// l'écran d'accueil, seule façon d'y recevoir appels et messages application
// fermée. Rien ailleurs (Android a sa propre invitation, beforeinstallprompt).
export function InvitationInstallationIphone() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(() => invitationInstallationVisible());
  const [guide, setGuide] = useState(false);
  if (!visible && !guide) return null;
  const masquer = () => { masquerInvitationInstallation(); setVisible(false); };
  return (
    <>
      {visible && !guide && (
        // « Installer » ouvre le guide : l'iPhone n'installe pas en un clic.
        <InstallBanner desc={t("install.ios.bannerDesc")}
          onInstall={() => setGuide(true)} onDismiss={masquer} />
      )}
      {guide && <GuideIphone fermer={() => { setGuide(false); masquer(); }} />}
    </>
  );
}
