"use client";

import { useLocale } from "@/components/locale-provider";
import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from "react-leaflet";
import { divIcon } from "leaflet";
import type { LatLngExpression, LeafletMouseEvent } from "leaflet";
import { Layers3, Navigation, TriangleAlert } from "lucide-react";
import { harborCity } from "@/data/harbor-city";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";
import { formatNumber } from "@/lib/format";
import type {
  CriticalLinkResult,
  EdgeId,
  NetworkNode,
  PathResult,
  SimulationResult,
} from "@/types/network";
import { decisionEdgeColor, type DecisionMapLayer } from "@/lib/decision/map-style";

interface Props {
  current: SimulationResult;
  baseline: SimulationResult;
  selectedEdgeId: EdgeId | null;
  highlightedEdgeId: EdgeId | null;
  onSelectEdge: (id: EdgeId | null) => void;
  normalRoute: PathResult;
  scenarioRoute: PathResult;
  showRoutes: boolean;
  showFlow: boolean;
  showTiles: boolean;
  fitKey: number;
  demoStep: number | null;
  analysisLayer?: DecisionMapLayer;
  critical?: readonly CriticalLinkResult[];
}

const bounds: [number, number][] = harborCity.nodes.map((n) => [n.latitude, n.longitude]);
const nodeById = new Map(harborCity.nodes.map((n) => [n.id, n]));
const point = (id: string): [number, number] => {
  const n = nodeById.get(id)!;
  return [n.latitude, n.longitude];
};
const river: LatLngExpression[] = [
  [35.5, 139.69],
  [35.485, 139.689],
  [35.473, 139.692],
  [35.464, 139.69],
  [35.454, 139.681],
  [35.445, 139.676],
  [35.428, 139.679],
  [35.428, 139.684],
  [35.445, 139.68],
  [35.455, 139.685],
  [35.464, 139.695],
  [35.474, 139.696],
  [35.485, 139.693],
  [35.5, 139.694],
];
const districts: { name: string; position: [number, number]; polygon: LatLngExpression[] }[] = [
  {
    name: "NORTH",
    position: [35.495, 139.653],
    polygon: [
      [35.496, 139.621],
      [35.496, 139.684],
      [35.484, 139.684],
      [35.482, 139.621],
    ],
  },
  {
    name: "WEST",
    position: [35.464, 139.615],
    polygon: [
      [35.482, 139.615],
      [35.482, 139.647],
      [35.455, 139.651],
      [35.455, 139.615],
    ],
  },
  {
    name: "CENTRAL",
    position: [35.47, 139.655],
    polygon: [
      [35.482, 139.649],
      [35.482, 139.686],
      [35.453, 139.676],
      [35.453, 139.652],
    ],
  },
  {
    name: "EAST",
    position: [35.494, 139.71],
    polygon: [
      [35.497, 139.696],
      [35.497, 139.722],
      [35.451, 139.722],
      [35.451, 139.696],
    ],
  },
  {
    name: "HARBOR",
    position: [35.429, 139.699],
    polygon: [
      [35.45, 139.657],
      [35.45, 139.722],
      [35.427, 139.722],
      [35.427, 139.657],
    ],
  },
];

const nodeSvg: Record<string, string> = {
  station: '<path d="M6 3h8v9H6zM7 15l1-3m4 0 1 3M8 6h4M8 9h4"/>',
  hospital: '<path d="M8 3h4v4h4v4h-4v4H8v-4H4V7h4z"/>',
  shelter: '<path d="m3 8 7-5 7 5M5 7v9h10V7M8 16v-5h4v5"/>',
  residential: '<path d="m3 8 7-5 7 5M5 7v9h10V7M8 16v-5h4v5"/>',
  commercial: '<path d="M4 16V5h12v11M7 8h1m4 0h1M7 11h1m4 0h1M9 16v-3h2v3"/>',
  school: '<path d="m2 7 8-4 8 4-8 4zM5 9v5c3 2 7 2 10 0V9"/>',
};
const markerIcon = (type: string) =>
  divIcon({
    className: `facility-marker marker-${type}`,
    html: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${nodeSvg[type] ?? ""}</svg>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
  });

function MapViewport({
  fitKey,
  selectedEdgeId,
}: {
  fitKey: number;
  selectedEdgeId: EdgeId | null;
}) {
  const map = useMap();
  useEffect(() => {
    let active = true;
    const fit = () => {
      if (!active || !map.getPane("mapPane")) return;
      const compact = map.getContainer().clientWidth < 600;
      map.invalidateSize();
      map.fitBounds(
        bounds,
        compact
          ? { paddingTopLeft: [24, 86], paddingBottomRight: [24, 80], animate: false }
          : { padding: [52, 54], animate: false },
      );
    };
    map.whenReady(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [map, fitKey]);
  useEffect(() => {
    if (!selectedEdgeId || !map.getPane("mapPane")) return;
    const edge = harborCity.edges.find((e) => e.id === selectedEdgeId)!;
    const a = nodeById.get(edge.source)!;
    const b = nodeById.get(edge.target)!;
    const center: [number, number] = [
      (a.latitude + b.latitude) / 2,
      (a.longitude + b.longitude) / 2,
    ];
    if (!map.getBounds().contains(center))
      map.panTo(center, {
        animate: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      });
  }, [map, selectedEdgeId]);
  return null;
}

function NodePopup({ node, current }: { node: NetworkNode; current: SimulationResult }) {
  const { t } = useLocale();

  const access = useMemo(() => {
    const graph = buildGraph(harborCity, current.closedEdgeIds);
    const services = harborCity.nodes.filter((n) => n.type === "hospital");
    return Math.min(
      ...services.map(
        (service) =>
          shortestPath(graph, node.id, service.id, (edge) => current.edgeStates[edge.id].travelTime)
            .travelTime,
      ),
    );
  }, [current, node]);
  const district = current.districts.find((d) => d.district === node.district)!;
  return (
    <div className="map-popup">
      <span>
        {t(node.type).toUpperCase()} · {t(node.district)}
      </span>
      <h4>{t(node.name)}</h4>
      <dl>
        <div>
          <dt>{t("District access")}</dt>
          <dd>{formatNumber(district.accessibility)}%</dd>
        </div>
        <div>
          <dt>{t("Nearest hospital")}</dt>
          <dd>
            {Number.isFinite(access) ? `${formatNumber(access)} ${t("min")}` : t("Unreachable")}
          </dd>
        </div>
        {node.populationWeight > 0 && (
          <div>
            <dt>{t("Population weight")}</dt>
            <dd>{formatNumber(node.populationWeight, 0)}</dd>
          </div>
        )}
      </dl>
      <small>{t("Synthetic model · not a safety assessment")}</small>
    </div>
  );
}

export default function NetworkMap(props: Props) {
  const { t, locale } = useLocale();

  const {
    current,
    baseline,
    selectedEdgeId,
    highlightedEdgeId,
    onSelectEdge,
    normalRoute,
    scenarioRoute,
    showRoutes,
    showFlow,
    showTiles,
    fitKey,
    demoStep,
    analysisLayer = "traffic",
    critical = [],
  } = props;
  const criticalById = useMemo(
    () => new Map(critical.map((item) => [item.edgeId, item.score])),
    [critical],
  );
  const maximumCriticality = Math.max(0, ...critical.map((item) => item.score));
  const [tileFailed, setTileFailed] = useState(false);
  const selected = harborCity.edges.find((e) => e.id === selectedEdgeId);
  const grid = useMemo(() => {
    const lines: LatLngExpression[][] = [];
    for (let lat = 35.425; lat < 35.501; lat += 0.0035)
      lines.push([
        [lat, 139.607],
        [lat, 139.728],
      ]);
    for (let lng = 139.609; lng < 139.73; lng += 0.004)
      lines.push([
        [35.425, lng],
        [35.501, lng],
      ]);
    return lines;
  }, []);
  const disturbed = current.closedEdgeIds.length > 0;
  return (
    <div className={`network-map ${demoStep === 1 ? "quake-pulse" : ""}`} data-testid="network-map">
      <MapContainer
        center={[35.465, 139.672]}
        zoom={13}
        zoomSnap={0.25}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={true}
        className="leaflet-map"
        minZoom={11}
        maxZoom={17}
      >
        <MapViewport fitKey={fitKey} selectedEdgeId={selectedEdgeId} />
        {showTiles && (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            key={locale}
            attribution={`&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> ${locale === "ja" ? "協力者 · 架空交通網" : "contributors · Synthetic network"}`}
            eventHandlers={{ tileerror: () => setTileFailed(true) }}
          />
        )}
        <Pane name="schematic" style={{ zIndex: 250 }}>
          {districts.map((d) => (
            <Polygon
              key={d.name}
              positions={d.polygon}
              interactive={false}
              pathOptions={{
                fillColor: "#294851",
                fillOpacity: 0.17,
                color: "#54717b",
                weight: 1,
                opacity: 0.2,
                dashArray: "3 6",
              }}
            />
          ))}
          {grid.map((positions, i) => (
            <Polyline
              key={i}
              positions={positions}
              interactive={false}
              pathOptions={{ color: "#78909b", weight: 1, opacity: 0.09 }}
            />
          ))}
          <Polygon
            positions={river}
            interactive={false}
            pathOptions={{
              fillColor: "#183f52",
              fillOpacity: 0.95,
              color: "#356578",
              weight: 1,
              opacity: 0.45,
            }}
          />
        </Pane>
        <Pane name="district-labels" style={{ zIndex: 300 }}>
          {districts.map((d) => (
            <Marker
              key={d.name}
              position={d.position}
              interactive={false}
              keyboard={false}
              icon={divIcon({
                className: "district-label",
                html: `<span>${t(d.name)}</span>`,
                iconSize: [100, 20],
                iconAnchor: [50, 10],
              })}
            />
          ))}
          <Marker
            position={[35.457, 139.687]}
            interactive={false}
            keyboard={false}
            icon={divIcon({
              className: "river-label",
              html: t("HARBOR RIVER"),
              iconSize: [110, 20],
              iconAnchor: [55, 10],
            })}
          />
        </Pane>
        {harborCity.edges.map((edge) => {
          const state = current.edgeStates[edge.id];
          const active = edge.id === selectedEdgeId || edge.id === highlightedEdgeId;
          const congested = state.available && state.utilization >= 1;
          const rail = edge.mode === "rail";
          const trafficColor = !state.available
            ? "#fb776a"
            : active
              ? "#fff2ab"
              : congested && showFlow
                ? "#efa55b"
                : rail
                  ? "#9db9e2"
                  : "#58c5c8";
          const color = decisionEdgeColor(
            analysisLayer,
            state.available,
            trafficColor,
            criticalById.get(edge.id),
            maximumCriticality,
            (state.utilization - baseline.edgeStates[edge.id].utilization) * 100,
            "#fb776a",
          );
          const weight = active
            ? 7
            : !state.available
              ? 4
              : showFlow
                ? Math.max(2.2, Math.min(6.5, 1.8 + state.utilization * 2.3))
                : 2.5;
          return (
            <Polyline
              key={`${edge.id}:${state.available}:${showFlow && state.volume > 800}`}
              positions={[point(edge.source), point(edge.target)]}
              className={`network-edge ${state.available && showFlow && state.volume > 800 ? "flow-edge" : ""} ${!state.available ? "closed-edge" : ""}`}
              pathOptions={{
                color,
                weight,
                opacity: active ? 1 : 0.82,
                dashArray: !state.available
                  ? "8 7"
                  : rail
                    ? "3 5"
                    : edge.mode === "pedestrian"
                      ? "2 4"
                      : showFlow && state.volume > 800
                        ? "10 1"
                        : undefined,
              }}
              eventHandlers={{
                click: (e: LeafletMouseEvent) => {
                  e.originalEvent.stopPropagation();
                  onSelectEdge(edge.id);
                },
              }}
            >
              <Tooltip sticky className="edge-tooltip">
                <b>{t(edge.name)}</b>
                <span>
                  {!state.available
                    ? t("× Closed")
                    : t("{utilization}% capacity · {time} min", {
                        utilization: formatNumber(state.utilization * 100, 0),
                        time: formatNumber(state.travelTime),
                      })}
                </span>
              </Tooltip>
            </Polyline>
          );
        })}
        {showRoutes && normalRoute.reachable && (
          <Polyline
            positions={normalRoute.nodeIds.map(point)}
            interactive={false}
            className="baseline-route"
            pathOptions={{ color: "#e8edf3", weight: 4, opacity: 0.75, dashArray: "5 9" }}
          />
        )}
        {showRoutes && scenarioRoute.reachable && (
          <Polyline
            positions={scenarioRoute.nodeIds.map(point)}
            interactive={false}
            className="scenario-route"
            pathOptions={{ color: "#f9d183", weight: 5, opacity: 1 }}
          />
        )}
        {harborCity.nodes.map((node) =>
          node.type === "intersection" ? (
            <CircleMarker
              key={node.id}
              center={[node.latitude, node.longitude]}
              radius={4}
              pathOptions={{ color: "#7fd7d9", fillColor: "#173443", weight: 2, fillOpacity: 1 }}
            >
              <Popup>
                <NodePopup node={node} current={current} />
              </Popup>
            </CircleMarker>
          ) : (
            <Marker
              key={`${node.id}:${locale}`}
              title={`${t(node.name)} · ${t(node.type)}`}
              position={[node.latitude, node.longitude]}
              icon={markerIcon(node.type)}
            >
              <Popup>
                <NodePopup node={node} current={current} />
              </Popup>
              {node.type !== "school" && (
                <Tooltip
                  permanent
                  direction={node.district === "West" ? "left" : "right"}
                  offset={node.district === "West" ? [-9, 0] : [9, 0]}
                  className={`node-label ${node.type}-label`}
                >
                  {t(node.name)}
                </Tooltip>
              )}
            </Marker>
          ),
        )}
        {current.closedEdgeIds.map((id) => {
          const edge = harborCity.edges.find((e) => e.id === id)!;
          const a = nodeById.get(edge.source)!;
          const b = nodeById.get(edge.target)!;
          return (
            <Marker
              key={`closed-${id}:${locale}`}
              title={t("Inspect closed {name}", { name: t(edge.name) })}
              position={[(a.latitude + b.latitude) / 2, (a.longitude + b.longitude) / 2]}
              icon={divIcon({
                className: "closure-marker",
                html: "<span>×</span>",
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })}
              eventHandlers={{ click: () => onSelectEdge(id) }}
            />
          );
        })}
      </MapContainer>
      <div className="map-caption">
        <span className={`map-status ${disturbed ? "disrupted" : ""}`}>
          <span className="status-dot" />
          {disturbed ? t("DISRUPTION ACTIVE") : t("NETWORK OPERATIONAL")}
        </span>
        <span>{t("Harbor City · Japan-inspired demonstration network")}</span>
      </div>
      <div className="map-north">
        <Navigation size={17} />
        <span>N</span>
      </div>
      {analysisLayer === "traffic" && (
        <div className="map-legend">
          <span>
            <i className="legend-line normal" />
            {t("Available")}
          </span>
          <span>
            <i className="legend-line rail" />
            {t("Rail")}
          </span>
          <span>
            <i className="legend-line congestion" />
            {t("At / over capacity")}
          </span>
          <span>
            <i className="legend-line closed" />
            {t("Closed")}
          </span>
          {showRoutes && (
            <span>
              <i className="legend-line route" />
              {t("Selected route")}
            </span>
          )}
        </div>
      )}
      <div className="map-data-label">
        {t("Demonstration network using synthetic mobility data")}
      </div>
      {selected && (
        <div className="map-selection-label">
          <Layers3 size={13} />
          {t(selected.name)}
          <span>
            {current.edgeStates[selected.id].available
              ? `${formatNumber(current.edgeStates[selected.id].volume, 0)} ${t("trips / h")}`
              : t("Closed")}
          </span>
        </div>
      )}
      {tileFailed && showTiles && (
        <div className="tile-notice" role="status">
          <TriangleAlert size={12} />
          {t("Basemap unavailable. The schematic network remains fully interactive.")}
        </div>
      )}
      {demoStep === 1 && (
        <div className="quake-overlay">
          <ActivityIcon />
          <b>{t("Earthquake detected")}</b>
          <span>{t("Applying synthetic infrastructure failures")}</span>
        </div>
      )}
      <span className="sr-only">
        {t("Normal demand: ")}
        {formatNumber(baseline.metrics.totalDemand, 0)}{" "}
        {t(
          " person-trips per hour. All map links are also accessible through the keyboard link selector above the map.",
        )}
      </span>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 80 32" width="64" height="32" fill="none" aria-hidden="true">
      <path
        d="M2 18h18l8-13 10 24 8-15h10l6-7 6 11h10"
        stroke="#ffb697"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
