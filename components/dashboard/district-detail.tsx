"use client";
import { useLocale } from "@/components/locale-provider";
import { ChevronDown } from "lucide-react";
import { formatNumber, signed } from "@/lib/format";
import type { SimulationResult } from "@/types/network";

export function DistrictDetail({
  baseline,
  current,
}: {
  baseline: SimulationResult;
  current: SimulationResult;
}) {
  const { t } = useLocale();

  return (
    <details className="district-details">
      <summary>
        {t("View district travel time & isolation")}
        <ChevronDown size={14} />
      </summary>
      <div className="services-table-wrap">
        <table className="services-table district-table">
          <thead>
            <tr>
              <th>{t("DISTRICT")}</th>
              <th>{t("POPULATION WEIGHT")}</th>
              <th>{t("AVG. TIME BEFORE → AFTER")}</th>
              <th>{t("ACCESS CHANGE")}</th>
              <th>{t("ISOLATED DEMAND")}</th>
            </tr>
          </thead>
          <tbody>
            {current.districts.map((d) => {
              const before = baseline.districts.find((b) => b.district === d.district)!;
              return (
                <tr key={t(d.district)}>
                  <th scope="row">{t(d.district)}</th>
                  <td>{formatNumber(d.population, 0)}</td>
                  <td>
                    {formatNumber(before.averageTravelTime)} →{" "}
                    <strong>
                      {formatNumber(d.averageTravelTime)} {t(" min")}
                    </strong>
                  </td>
                  <td className={d.accessibility < before.accessibility ? "adverse-text" : ""}>
                    {signed(d.accessibility - before.accessibility)} {t(" pts")}
                  </td>
                  <td>
                    <strong>{formatNumber(d.isolationRisk)}%</strong> ·{" "}
                    {formatNumber(d.disconnectedDemand, 0)} {t(" trips / h")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        {t(
          "District travel times use demand originating at residential nodes. Isolation is the share of that demand with an unreachable destination.",
        )}
      </p>
    </details>
  );
}
