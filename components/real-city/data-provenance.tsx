"use client";
import { useLocale } from "@/components/locale-provider";
import { areaDimensions } from "@/lib/osm/geo";
import type { RealCityNetwork } from "@/types/real-city";
export function NetworkSummary({
  snapshot,
  source,
}: {
  snapshot: RealCityNetwork;
  source: string;
}) {
  const { t } = useLocale();
  const counts = [
    ["Analysis area", `${areaDimensions(snapshot.bbox).area.toFixed(2)} km²`],
    ["Intersections", snapshot.stats.intersections],
    ["Road links", snapshot.stats.roadLinks],
    ["Hospitals & clinics", snapshot.facilities.filter((f) => f.type === "hospital").length],
    ["Stations", snapshot.facilities.filter((f) => f.type === "station").length],
    ["Shelters", snapshot.facilities.filter((f) => f.type === "shelter").length],
    ["Residential origins", snapshot.stats.origins],
    ["Modeled OD pairs", snapshot.odPairs.length],
  ];
  return (
    <article className="panel real-summary" data-testid="network-summary">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("REAL CITY NETWORK READY")}</span>
          <h3>{t("Network summary")}</h3>
          <p>{t(source)}</p>
        </div>
        <span className="panel-tag">v{snapshot.realCityModelVersion}</span>
      </div>
      <div className="real-summary-grid">
        {counts.map(([name, value]) => (
          <div key={name}>
            <strong>{value}</strong>
            <span>{t(String(name))}</span>
          </div>
        ))}
      </div>
      <p className="table-note">
        {t("Road geometry & facilities: OpenStreetMap. Travel demand: synthetic model.")}
      </p>
      <p className="table-note">
        {t("Boundary-limited model: routes outside the selected rectangle are excluded.")}{" "}
        {t("{count} disconnected components · {excluded} facilities not connected", {
          count: snapshot.stats.components,
          excluded: snapshot.stats.excludedFacilities,
        })}
      </p>
    </article>
  );
}
export function DataProvenance({ snapshot }: { snapshot: RealCityNetwork }) {
  const { t } = useLocale();
  const rows = [
    ["Road geometry & intersections", "OpenStreetMap"],
    ["Road classification", "OpenStreetMap"],
    ["Hospitals, clinics & stations", "OpenStreetMap"],
    ["Speed", "OSM maxspeed / estimated"],
    ["Lanes", "OSM / estimated"],
    ["Traffic capacity", "Modeled estimate"],
    ["Facility connections", "Nearest road node · modeled"],
    ["Traffic demand", "Synthetic demand over real infrastructure"],
    ["Residential weights", "Local road length proxy · not population"],
    ["Accessibility", "Modeled · available service categories only"],
    ["Scenario failure probability", "User-defined assumption"],
    ["Relative recovery cost", "User-defined score, not financial cost"],
  ];
  return (
    <details className="panel provenance-panel" open>
      <summary>
        {t("Data & assumptions")}
        <span>{t("See what is observed and what is modeled")}</span>
      </summary>
      <div className="provenance-content">
        <table>
          <tbody>
            {rows.map(([name, source]) => (
              <tr key={name}>
                <th>{t(name)}</th>
                <td>{t(source)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="coverage-grid">
          <h4>{t("Data coverage")}</h4>
          <p>
            {t("Speed tags available")}:{" "}
            <strong>{snapshot.coverage.speedTagsPercent.toFixed(0)}%</strong>
          </p>
          <p>
            {t("Lane tags available")}:{" "}
            <strong>{snapshot.coverage.laneTagsPercent.toFixed(0)}%</strong>
          </p>
          <p>
            {t("Road names available")}:{" "}
            <strong>{snapshot.coverage.namesPercent.toFixed(0)}%</strong>
          </p>
          <p>
            {t("Capacity estimated")}: <strong>100%</strong>
          </p>
          <p>
            {t("OSM data timestamp")}: {snapshot.osmMetadata.timestamp ?? t("Unknown")}
          </p>
        </div>
      </div>
    </details>
  );
}
