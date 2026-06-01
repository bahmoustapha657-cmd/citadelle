import { useTranslation } from "react-i18next";
import { getMonnaie } from "../../constants";
import { Chargement, Vide } from "../ui";
import { BilanStats } from "./bilan-tab/BilanStats";
import { BilanBlocage } from "./bilan-tab/BilanBlocage";
import { BilanGraphiques } from "./bilan-tab/BilanGraphiques";

export function BilanTab({
  schoolInfo, canCreate, toggleBlocage, recettes, depenses, cR, cD,
  totR, totD, totVers, totNetSec, totNetPrim, totNetPers,
  impaye, pctImpaye, salairesMois, moisLabel, mensualiteOverview,
  periodes = ["T1", "T2", "T3"],
}) {
  const { t } = useTranslation();
  const blocage = !!schoolInfo.blocageParentImpaye;
  const cur = getMonnaie();

  return (
    <div>
      <BilanStats
        t={t} cur={cur} totR={totR} totD={totD} totVers={totVers}
        totNetSec={totNetSec} totNetPrim={totNetPrim} totNetPers={totNetPers}
        impaye={impaye} pctImpaye={pctImpaye} salairesMois={salairesMois}
        moisLabel={moisLabel} mensualiteOverview={mensualiteOverview}
      />
      <BilanBlocage blocage={blocage} canCreate={canCreate} toggleBlocage={toggleBlocage} />
      {(cR||cD)?<Chargement/>:totR===0&&totD===0?<Vide icone="📊" msg="Aucune donnée financière"/>
        :<BilanGraphiques
          recettes={recettes} depenses={depenses} totR={totR} totD={totD}
          mensualiteOverview={mensualiteOverview} periodes={periodes}
        />}
    </div>
  );
}
