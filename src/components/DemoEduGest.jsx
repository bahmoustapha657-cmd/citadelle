import React, { useState } from "react";
import Logo from "../Logo";
import { GlobalStyles } from "../styles";
import { Badge, Btn, Card, LectureSeule, Tabs } from "./ui";
import { tabs } from "./demo/demo-data";
import { DemoTabContent } from "./demo/DemoTabContent";
import { BulletinDemoModale } from "./demo/BulletinDemoModale";

function DemoEduGest({ onConnexion, onInscription, onRetour }) {
  const [tab, setTab] = useState("direction");
  const [bulletinOuvert, setBulletinOuvert] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#eef4fb 0%,#f8fbff 100%)", color: "var(--lc-text-brand, #0A1628)" }}>
      <GlobalStyles />
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "24px 18px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo width={160} height={46} />
            <Badge color="purple">Démo publique</Badge>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Btn v="ghost" onClick={onRetour}>Retour</Btn>
            <Btn v="ghost" onClick={onConnexion}>Accéder à mon école</Btn>
            <Btn onClick={onInscription}>Créer mon école</Btn>
          </div>
        </div>

        <Card style={{ padding: 22, marginBottom: 18, background: "linear-gradient(135deg,#0A1628,#14335f)", color: "#fff", border: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 18, flexWrap: "wrap" }}>
            <div style={{ maxWidth: 640 }}>
              <Badge color="teal">École démo en lecture seule</Badge>
              <h1 style={{ margin: "16px 0 10px", fontSize: "clamp(28px,4vw,42px)", lineHeight: 1.1 }}>
                Découvrez EduGest sans inscription
              </h1>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7, color: "rgba(255,255,255,0.82)" }}>
                Cette démo vous montre comment une direction suit les élèves, les notes, la comptabilité, l'emploi du temps,
                la discipline, le portail enseignant et le portail parent — tout sur le même espace. Données fictives.
              </p>
            </div>
            <div style={{ minWidth: 240, alignSelf: "stretch", display: "grid", gap: 12 }}>
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.08em" }}>École</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>Groupe scolaire Djoma Démo</div>
                <div style={{ marginTop: 4, fontSize: 12, opacity: 0.7 }}>Kindia · Guinée · 842 élèves</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 14, padding: 14 }}>
                <div style={{ fontSize: 12, opacity: 0.72, textTransform: "uppercase", letterSpacing: "0.08em" }}>Parcours</div>
                <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.6 }}>Direction · Enseignant · Comptable · Parent</div>
              </div>
            </div>
          </div>
        </Card>

        <LectureSeule />

        <Card style={{ padding: 18 }}>
          <Tabs items={tabs} actif={tab} onChange={setTab} />
          <DemoTabContent tab={tab} onApercuBulletin={() => setBulletinOuvert(true)} />
        </Card>
      </div>

      {bulletinOuvert && (
        <BulletinDemoModale onInscription={onInscription} onClose={() => setBulletinOuvert(false)} />
      )}
    </div>
  );
}

export { DemoEduGest };
