"use client";
import { ArrowRight, CornerUpRight, XCircle } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import { formatNumber } from "@/lib/format";
import type { Network, SimulationResult } from "@/types/network";

/** Plain-language consequences from the exact current simulation, not a second model. */
export function ImpactCue({
  network,
  baseline,
  current,
  onHighlight,
}: {
  network: Network;
  baseline: SimulationResult;
  current: SimulationResult;
  onHighlight: (id: string) => void;
}) {
  const { t } = useLocale();
  const closed = current.closedEdgeIds.length;
  const redirected = network.edges
    .filter((edge) => edge.osm && current.edgeStates[edge.id]?.available)
    .map((edge) => ({
      edge,
      gain:
        (current.edgeStates[edge.id]?.volume ?? 0) - (baseline.edgeStates[edge.id]?.volume ?? 0),
    }))
    .filter(
      ({ edge, gain }) => gain > Math.max(1, (baseline.edgeStates[edge.id]?.volume ?? 0) * 0.1),
    )
    .sort((a, b) => b.gain - a.gain);
  const affectedTrips = current.assignments.filter((assignment) => {
    const before = baseline.assignments.find((item) => item.od.id === assignment.od.id);
    return (
      before?.path.reachable &&
      (!assignment.path.reachable ||
        assignment.path.edgeIds.join("|") !== before.path.edgeIds.join("|"))
    );
  }).length;
  const extraDisconnected = Math.max(
    0,
    current.metrics.disconnectedODPairs - baseline.metrics.disconnectedODPairs,
  );
  const metrics = [
    [
      "Avg. travel time",
      baseline.metrics.averageTravelTime,
      current.metrics.averageTravelTime,
      t("min"),
    ],
    [
      "Essential-service access",
      baseline.metrics.accessibility,
      current.metrics.accessibility,
      "%",
    ],
    ["Resilience score", baseline.metrics.resilienceScore, current.metrics.resilienceScore, "/100"],
  ] as const;
  return (
    <section
      id="real-city-impact-cue"
      className="impact-cue"
      aria-live="polite"
      aria-labelledby="real-city-impact-title"
      tabIndex={-1}
      data-testid="impact-cue"
    >
      <div className="impact-cue-title">
        <span className="eyebrow">
          {t(closed ? "WHAT CHANGED AFTER THE CLOSURE?" : "YOUR FIRST EXPERIMENT")}
        </span>
        <h3 id="real-city-impact-title">
          {t(
            closed
              ? "Road closures. Effects across the network."
              : "Choose a road, close it, see what changes.",
          )}
        </h3>
        <p>
          {t(
            closed
              ? "All values compare this same area before and after your selected closures."
              : "Click a colored road on the map, then press Simulate closure. The map and numbers update automatically.",
          )}
        </p>
      </div>
      {closed > 0 && (
        <>
          <div className="impact-cue-chain">
            <span>
              <XCircle size={17} />
              <b>{closed}</b>
              {t("closed links")}
            </span>
            <ArrowRight size={16} />
            <span>
              <CornerUpRight size={17} />
              <b>{affectedTrips}</b>
              {t("modeled routes changed")}
            </span>
            <ArrowRight size={16} />
            <span>
              <b>{redirected.length}</b>
              {t("roads carrying more modeled traffic")}
            </span>
          </div>
          <div className="impact-cue-metrics">
            {metrics.map(([label, before, after, unit]) => {
              const missing =
                label === "Essential-service access" &&
                network.accessibilityCategories?.length === 0;
              const change = after - before;
              return (
                <div key={label}>
                  <span>{t(label)}</span>
                  <strong>
                    {missing ? (
                      t("N/A")
                    ) : (
                      <>
                        {formatNumber(before)} <ArrowRight size={15} /> {formatNumber(after)}{" "}
                        <small>{unit}</small>
                      </>
                    )}
                  </strong>
                  {!missing && (
                    <small>
                      {change > 0 ? "+" : ""}
                      {formatNumber(change)} {label === "Avg. travel time" ? t("min") : t("points")}{" "}
                      {t("from baseline")}
                    </small>
                  )}
                </div>
              );
            })}
          </div>
          {extraDisconnected > 0 && (
            <p className="impact-access-warning">
              {t(
                "{count} additional modeled OD pairs have no remaining route. Lower flow or congestion does not mean better access.",
                { count: extraDisconnected },
              )}
            </p>
          )}
          {redirected[0] ? (
            <button className="text-button" onClick={() => onHighlight(redirected[0].edge.id)}>
              {t("Show the road taking the most extra traffic")} → {redirected[0].edge.name}
            </button>
          ) : (
            <p className="table-note">
              {t(
                "No remaining road gained substantial modeled flow. Check disconnected journeys and access as well as travel time.",
              )}
            </p>
          )}
          <p className="table-note">
            {t(
              "Changed routes counts OD pairs whose shortest path changed or became unreachable. Extra-flow roads exceed baseline flow by 10% and at least one modeled unit.",
            )}
          </p>
        </>
      )}
    </section>
  );
}
