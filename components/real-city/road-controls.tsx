"use client";
import { useLocale } from "@/components/locale-provider";
import { formatNumber } from "@/lib/format";
import type { NetworkEdge, PathResult, SimulationResult } from "@/types/network";
import type { RealCityNetwork } from "@/types/real-city";
import { realCityConfig } from "@/lib/real-city/model-config";

export function RoadControls({
  snapshot,
  current,
  selectedId,
  closedIds,
  onSelect,
  onToggle,
  onReset,
  busy,
  origin,
  destination,
  onOrigin,
  onDestination,
  beforeRoute,
  afterRoute,
}: {
  snapshot: RealCityNetwork;
  current: SimulationResult | null;
  selectedId: string | null;
  closedIds: string[];
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onReset: () => void;
  busy: boolean;
  origin: string;
  destination: string;
  onOrigin: (id: string) => void;
  onDestination: (id: string) => void;
  beforeRoute: PathResult | null;
  afterRoute: PathResult | null;
}) {
  const { t } = useLocale();
  const roads = snapshot.network.edges.filter((e) => e.osm);
  const edge = roads.find((e) => e.id === selectedId);
  const origins = snapshot.network.nodes.filter((n) => n.type === "residential");
  const destinations = snapshot.network.nodes.filter(
    (n) => n.essentialService || n.type === "commercial" || n.type === "school",
  );
  return (
    <article className="panel real-controls">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("WHAT-IF DISRUPTION")}</span>
          <h3>{t("Click a road. See the ripple.")}</h3>
          <p>{t("Manual closures · no damage prediction")}</p>
        </div>
      </div>
      <label className="field-label" htmlFor="real-link-select">
        {t("Inspect real road")}
      </label>
      <select
        id="real-link-select"
        value={selectedId ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="">{t("Select on map…")}</option>
        {roads.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name} · {e.id}
          </option>
        ))}
      </select>
      {edge ? (
        <RoadInspector
          edge={edge}
          current={current}
          closed={closedIds.includes(edge.id)}
          busy={
            busy || (!closedIds.includes(edge.id) && closedIds.length >= realCityConfig.maxClosures)
          }
          onToggle={() => onToggle(edge.id)}
        />
      ) : (
        <p className="selection-empty">
          {t("Select a road on the map to inspect its data and simulate a closure.")}
        </p>
      )}
      <div className="active-disruptions">
        <h4>
          {t("Active disruptions")} <span>{closedIds.length}</span>
        </h4>
        {closedIds.length ? (
          <ul>
            {closedIds.map((id) => (
              <li key={id}>
                <span>{roads.find((e) => e.id === id)?.name}</span>
                <button disabled={busy} className="text-button" onClick={() => onToggle(id)}>
                  {t("Reopen")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("No roads closed")}</p>
        )}
        <button
          className="button button-secondary"
          disabled={!closedIds.length || busy}
          onClick={onReset}
        >
          {t("Clear all disruptions")}
        </button>
      </div>
      <div className="real-route">
        <h4>{t("Route Explorer")}</h4>
        <label className="field-label" htmlFor="real-origin">
          {t("Origin")}
        </label>
        <select id="real-origin" value={origin} onChange={(e) => onOrigin(e.target.value)}>
          {origins.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name} · {t(n.district)}
            </option>
          ))}
        </select>
        <label className="field-label" htmlFor="real-destination">
          {t("Destination")}
        </label>
        <select
          id="real-destination"
          value={destination}
          onChange={(e) => onDestination(e.target.value)}
        >
          {destinations.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
        {afterRoute && beforeRoute && (
          <div className="real-route-result" data-testid="real-route-time">
            {t("Baseline")}:{" "}
            {beforeRoute.reachable
              ? `${formatNumber(beforeRoute.travelTime)} ${t("min")}`
              : t("Unavailable")}{" "}
            <b>→</b> {t("Scenario")}:{" "}
            {afterRoute.reachable
              ? `${formatNumber(afterRoute.travelTime)} ${t("min")}`
              : t("Unavailable")}
            <p>
              {afterRoute.reachable
                ? `${formatNumber(afterRoute.distance, 2)} km · ${afterRoute.edgeIds.length} ${t("links")}`
                : t("No route available under the current disruption scenario.")}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
function RoadInspector({
  edge,
  current,
  closed,
  busy,
  onToggle,
}: {
  edge: NetworkEdge;
  current: SimulationResult | null;
  closed: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const { t } = useLocale();
  const o = edge.osm!,
    flow = current?.edgeStates[edge.id];
  const rows = [
    ["OSM class", o.highway],
    ["Length", `${formatNumber(edge.distance, 2)} km`],
    ["Estimated speed", `${formatNumber(o.speedKmh, 0)} km/h · ${t(o.speedSource)}`],
    ["Estimated capacity", `${edge.capacity} ${t("modeled units/h")}`],
    ["Lanes (total)", `${o.lanes} · ${t(o.lanesSource)}`],
    ["Direction", t(o.oneway ? "One-way" : "Two-way shared capacity")],
    ["Bridge", t(o.bridge ? "Yes" : "No")],
    ["Tunnel", t(o.tunnel ? "Yes" : "No")],
    [
      "Current modeled flow",
      flow ? `${formatNumber(flow.volume, 0)} ${t("modeled units/h")}` : t("Calculating…"),
    ],
    ["Utilization", flow ? `${formatNumber(flow.utilization * 100)}%` : t("Calculating…")],
    ["Status", t(closed ? "Closed" : "Available")],
  ];
  return (
    <div className="real-inspector" data-testid="real-inspector">
      <h4>
        {edge.name}
        {o.bridge && <span className="panel-tag">{t("Bridge")}</span>}
      </h4>
      <dl>
        {rows.map(([name, value]) => (
          <div key={name}>
            <dt>{t(name)}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <small>
        OSM way {o.wayId} · {edge.id}
      </small>
      <button
        className={`button ${closed ? "button-recover" : "button-close"}`}
        disabled={busy}
        onClick={onToggle}
      >
        {t(closed ? "Reopen road" : "Simulate closure")}
      </button>
    </div>
  );
}
