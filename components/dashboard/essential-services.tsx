"use client";

import { useLocale } from "@/components/locale-provider";
import { ArrowRight, Hospital, House, TriangleAlert } from "lucide-react";
import { formatNumber, signed } from "@/lib/format";
import type { SimulationResult } from "@/types/network";

export function EssentialServices({
  baseline,
  current,
  modeledDemand = false,
}: {
  baseline: SimulationResult;
  current: SimulationResult;
  modeledDemand?: boolean;
}) {
  const { t } = useLocale();

  const services = current.services.filter(
    (s) => modeledDemand || s.type === "hospital" || s.type === "shelter",
  );
  const loss = services.some(
    (s) =>
      s.type === "hospital" &&
      s.reachablePopulation <
        baseline.services.find((b) => b.nodeId === s.nodeId)!.reachablePopulation - 0.05,
  );
  return (
    <article className="panel services-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("BEYOND THE CITYWIDE AVERAGE")}</span>
          <h3>{t("Essential services access")}</h3>
          <p>
            {t(
              modeledDemand
                ? "Demand-proxy share able to reach each imported facility within its model threshold."
                : "Population able to reach each facility within its model threshold.",
            )}
          </p>
        </div>
        <span className={`service-risk ${loss ? "has-risk" : ""}`}>
          {loss ? <TriangleAlert size={13} /> : <Hospital size={13} />}{" "}
          {modeledDemand && !services.some((s) => s.type === "hospital")
            ? t("Hospital analysis unavailable")
            : loss
              ? t("Emergency access risk increased")
              : current.closedEdgeIds.length
                ? t("No modeled hospital access loss")
                : t("Reference access")}
        </span>
      </div>
      <div className="services-table-wrap">
        <table className="services-table">
          <thead>
            <tr>
              <th>{t("FACILITY")}</th>
              <th>{t("THRESHOLD")}</th>
              <th>{t("BASELINE")}</th>
              <th aria-label={t("change")} />
              <th>{t("SCENARIO")}</th>
              <th>{t("CHANGE")}</th>
            </tr>
          </thead>
          <tbody>
            {!services.length && (
              <tr>
                <td colSpan={6}>
                  {t(
                    "No supported essential facilities were connected. Accessibility is unavailable.",
                  )}
                </td>
              </tr>
            )}
            {services.map((service) => {
              const before = baseline.services.find(
                (b) => b.nodeId === service.nodeId,
              )!.reachablePopulation;
              const delta = service.reachablePopulation - before;
              const Icon = service.type === "hospital" ? Hospital : House;
              return (
                <tr key={service.nodeId}>
                  <th>
                    <span className={`facility-icon ${service.type}`}>
                      <Icon size={14} />
                    </span>
                    {modeledDemand ? service.name : t(service.name)}
                  </th>
                  <td>
                    {service.threshold} {t(" min")}
                  </td>
                  <td>{formatNumber(before)}%</td>
                  <td>
                    <ArrowRight size={13} />
                  </td>
                  <td>
                    <strong>{formatNumber(service.reachablePopulation)}%</strong>
                  </td>
                  <td>
                    <span
                      className={
                        delta < -0.05
                          ? "adverse-text"
                          : delta > 0.05
                            ? "positive-text"
                            : "muted-text"
                      }
                    >
                      {signed(delta)} {t(" pts")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="table-note">
        {t(
          "Modeled accessibility describes reachability and time. It does not certify a facility, route, or destination as safe.",
        )}
      </p>
    </article>
  );
}
