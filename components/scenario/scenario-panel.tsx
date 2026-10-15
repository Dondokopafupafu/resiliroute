"use client";

import { useLocale } from "@/components/locale-provider";
import {
  Activity,
  ArrowRight,
  ArrowRightLeft,
  Check,
  ChevronDown,
  CloudRain,
  MousePointer2,
  RotateCcw,
  TrainFront,
  TriangleAlert,
  X,
} from "lucide-react";
import { harborCity } from "@/data/harbor-city";
import { scenarios } from "@/data/scenarios";
import { formatNumber, percentChange, signed } from "@/lib/format";
import type { EdgeId, PathResult, ScenarioId, SimulationResult } from "@/types/network";

const choices = [
  { id: "normal", icon: Activity, label: "Normal" },
  { id: "earthquake", icon: Activity, label: "Earthquake" },
  { id: "flood", icon: CloudRain, label: "Flood" },
  { id: "rail", icon: TrainFront, label: "Rail outage" },
  { id: "custom", icon: MousePointer2, label: "Custom" },
] as const;

interface Props {
  scenarioId: ScenarioId;
  current: SimulationResult;
  selectedEdgeId: EdgeId | null;
  onScenario: (id: ScenarioId) => void;
  onToggleEdge: (id: EdgeId) => void;
  onSelectEdge: (id: EdgeId | null) => void;
  onClear: () => void;
  origin: string;
  destination: string;
  onOrigin: (id: string) => void;
  onDestination: (id: string) => void;
  normalRoute: PathResult;
  scenarioRoute: PathResult;
  disabled: boolean;
}

export function ScenarioPanel(props: Props) {
  const { t } = useLocale();

  const {
    scenarioId,
    current,
    selectedEdgeId,
    onScenario,
    onToggleEdge,
    onSelectEdge,
    onClear,
    origin,
    destination,
    onOrigin,
    onDestination,
    normalRoute,
    scenarioRoute,
    disabled,
  } = props;
  const selected = harborCity.edges.find((e) => e.id === selectedEdgeId);
  const state = selected ? current.edgeStates[selected.id] : null;
  const changed = current.closedEdgeIds.length > 0;
  return (
    <aside
      className="panel scenario-panel"
      id="scenario-controls"
      aria-label={t("Scenario controls")}
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{t("SIMULATION CONTROLS")}</span>
          <h3>{t("Stress-test the city")}</h3>
        </div>
        <span className="step-number">01</span>
      </div>
      <fieldset className="scenario-options" disabled={disabled}>
        <legend>{t("Select a disruption")}</legend>
        {choices.map(({ id, label, icon: Icon }) => (
          <button
            type="button"
            key={id}
            aria-pressed={scenarioId === id}
            className={`scenario-choice ${scenarioId === id ? "selected" : ""} ${id === "normal" ? "normal-choice" : ""}`}
            onClick={() => onScenario(id)}
            data-testid={`scenario-${id}`}
          >
            <Icon size={15} />
            <span>{t(label)}</span>
            {scenarioId === id && <Check size={13} />}
          </button>
        ))}
      </fieldset>
      <p className="scenario-description">{t(scenarios[scenarioId].description)}</p>
      <div className="active-disruptions">
        <div className="control-label">
          <span>
            {t("Active disruptions ")}
            <b>{current.closedEdgeIds.length}</b>
          </span>
          {changed && (
            <button className="text-button" onClick={onClear} disabled={disabled}>
              {t("Clear all")}
            </button>
          )}
        </div>
        {changed ? (
          <ul>
            {current.closedEdgeIds.map((id) => (
              <li key={id}>
                <TriangleAlert size={12} />
                <button className="disruption-name" onClick={() => onSelectEdge(id)}>
                  {t(harborCity.edges.find((e) => e.id === id)!.name)}
                </button>
                <button
                  className="remove-disruption"
                  onClick={() => onToggleEdge(id)}
                  aria-label={t("Reopen {name}", {
                    name: t(harborCity.edges.find((e) => e.id === id)!.name),
                  })}
                  disabled={disabled}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-disruptions">
            <Check size={14} />
            {t("All 42 links operational")}
          </p>
        )}
      </div>
      {selected && state ? (
        <div className="selected-link" data-testid="selected-link">
          <div className="control-label">
            <span>{t("SELECTED LINK")}</span>
            <button
              className="text-button"
              onClick={() => onSelectEdge(null)}
              aria-label={t("Deselect link")}
            >
              <X size={14} />
            </button>
          </div>
          <h4>{t(selected.name)}</h4>
          <div className="link-stats">
            <span>
              {t(selected.mode)}
              <strong>{state.available ? t("Open") : t("Closed")}</strong>
            </span>
            <span>
              {t("Capacity")}
              <strong>
                {formatNumber(selected.capacity, 0)} {t(" / h")}
              </strong>
            </span>
            <span>
              {t("Volume")}
              <strong>
                {formatNumber(state.volume, 0)} {t(" / h")}
              </strong>
            </span>
            <span>
              {t("Utilization")}
              <strong>{formatNumber(state.utilization * 100, 0)}%</strong>
            </span>
            <span>
              {t("Travel time")}
              <strong>
                {state.available
                  ? `${formatNumber(state.travelTime)} ${t("min")}`
                  : t("Unavailable")}
              </strong>
            </span>
            <span>
              {t("Risk")}
              <strong>{t(selected.riskLevel)}</strong>
            </span>
          </div>
          <button
            className={`button full-width ${state.available ? "button-danger" : "button-teal"}`}
            disabled={disabled}
            onClick={() => onToggleEdge(selected.id)}
          >
            {state.available ? (
              <>
                <X size={14} />
                {t("Close link")}
              </>
            ) : (
              <>
                <RotateCcw size={14} />
                {t("Reopen link")}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="map-hint">
          <MousePointer2 size={15} />
          <span>{t("Select any link on the map to inspect or close it.")}</span>
        </div>
      )}
      <div className="route-explorer">
        <div className="control-label">
          <span>
            <ArrowRightLeft size={14} />
            {t("ROUTE EXPLORER")}
          </span>
          <button
            className="text-button"
            onClick={() => {
              onOrigin(destination);
              onDestination(origin);
            }}
            disabled={disabled}
            aria-label={t("Swap origin and destination")}
          >
            <ArrowRightLeft size={14} />
          </button>
        </div>
        <div className="route-inputs">
          <label>
            {t("Origin")}
            <div className="select-wrap">
              <select
                value={origin}
                onChange={(e) => onOrigin(e.target.value)}
                disabled={disabled}
                aria-label={t("Origin")}
              >
                {harborCity.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {t(n.name)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
          </label>
          <label>
            {t("Destination")}
            <div className="select-wrap">
              <select
                value={destination}
                onChange={(e) => onDestination(e.target.value)}
                disabled={disabled}
                aria-label={t("Destination")}
              >
                {harborCity.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {t(n.name)}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </div>
          </label>
        </div>
        {scenarioRoute.reachable ? (
          <>
            <div className="route-comparison">
              <span>
                <small>{t("BASELINE")}</small>
                <b>
                  {formatNumber(normalRoute.travelTime)}
                  <em> {t(" min")}</em>
                </b>
              </span>
              <ArrowRight size={16} />
              <span>
                <small>{t("SCENARIO")}</small>
                <b className={changed ? "warning-text" : ""} data-testid="route-time">
                  {formatNumber(scenarioRoute.travelTime)}
                  <em> {t(" min")}</em>
                </b>
              </span>
            </div>
            <div className="route-meta">
              <span>
                {formatNumber(scenarioRoute.distance)} {t(" km · ")}
                {scenarioRoute.edgeIds.length} {t(" links")}
              </span>
              <strong>
                {origin === destination
                  ? t("Same location")
                  : t("{change}% detour", {
                      change: signed(
                        percentChange(normalRoute.travelTime, scenarioRoute.travelTime),
                        0,
                      ),
                    })}
              </strong>
            </div>
          </>
        ) : (
          <p className="unreachable" role="status">
            <TriangleAlert size={16} />
            {t("No route available under the current disruption scenario.")}
          </p>
        )}
      </div>
      <div className="panel-bottom">
        <span className="status-dot" />
        {t("Computed in your browser · synthetic demand")}
      </div>
    </aside>
  );
}
