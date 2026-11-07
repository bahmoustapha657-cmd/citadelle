import { useTranslation } from "react-i18next";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getAnnee } from "../../constants";
import { Card } from "../ui";
import { axe, corpsCarte, grille, grilleSouple, infobulle, sousTitre, titreCarte, TONS } from "./tdb-styles";

function Courbe({ data, cle, couleur, nom, domaine, format }) {
  const id = `tdb-degrade-${cle}`;
  return (
    <ResponsiveContainer width="100%" height={170}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={couleur} stopOpacity={0.22} />
            <stop offset="100%" stopColor={couleur} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={grille} />
        <XAxis dataKey="mois" tick={{ ...axe, fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis domain={domaine} tick={{ ...axe, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={format} allowDecimals={false} />
        <Tooltip {...infobulle} cursor={{ stroke: "rgba(148,163,184,0.4)" }} formatter={format} />
        <Area type="monotone" dataKey={cle} stroke={couleur} strokeWidth={2} fill={`url(#${id})`} dot={false} activeDot={{ r: 4 }} name={nom} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrendsCard({ c1, annee, dataTendance }) {
  const { t } = useTranslation();
  const pct = (v) => `${v}%`;
  return (
    <Card><div style={corpsCarte}>
      <p style={titreCarte}>{t("dashboard.annualTrends")} — {annee || getAnnee()}</p>
      <div style={{ ...grilleSouple(280), gap: 24 }}>
        <div>
          <p style={sousTitre}>{t("dashboard.paymentRatePct")}</p>
          <Courbe data={dataTendance} cle="taux" couleur={c1} nom={t("dashboard.paymentRate")} domaine={[0, 100]} format={pct} />
        </div>
        <div>
          <p style={sousTitre}>{t("dashboard.absencesEntered")}</p>
          <Courbe data={dataTendance} cle="absences" couleur={TONS.danger} nom={t("dashboard.absencesLabel")} />
        </div>
      </div>
    </div></Card>
  );
}
