"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Rectangle,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { useLocale } from "@/components/locale-provider";
import type { BoundingBox, RealCityNetwork } from "@/types/real-city";
import type { CriticalLinkResult, PathResult, SimulationResult } from "@/types/network";
import { decisionEdgeColor, type DecisionMapLayer } from "@/lib/decision/map-style";

interface Props {
  bbox: BoundingBox | null;
  snapshot: RealCityNetwork | null;
  current: SimulationResult | null;
  selecting: boolean;
  fitKey: number;
  onBounds: (b: BoundingBox) => void;
  onSelect: (id: string) => void;
  selectedId: string | null;
  highlightedId: string | null;
  bridgesOnly: boolean;
  showFacilities: boolean;
  showRoutes: boolean;
  showFlow: boolean;
  normalRoute: PathResult | null;
  scenarioRoute: PathResult | null;
  baseline?: SimulationResult | null;
  analysisLayer?: DecisionMapLayer;
  critical?: readonly CriticalLinkResult[];
}
function Selection({
  bbox,
  selecting,
  fitKey,
  onBounds,
}: Pick<Props, "bbox" | "selecting" | "fitKey" | "onBounds">) {
  const map = useMap();
  const [first, setFirst] = useState<[number, number] | null>(null);
  const [preview, setPreview] = useState<[number, number] | null>(null);
  const [selectionKey, setSelectionKey] = useState<number | null>(null);
  const activeFirst = selectionKey === fitKey ? first : null;
  useMapEvents({
    click(event) {
      if (!selecting) return;
      const p: [number, number] = [event.latlng.lat, event.latlng.lng];
      if (!activeFirst) {
        setFirst(p);
        setPreview(p);
        setSelectionKey(fitKey);
      } else {
        onBounds({
          south: Math.min(activeFirst[0], p[0]),
          west: Math.min(activeFirst[1], p[1]),
          north: Math.max(activeFirst[0], p[0]),
          east: Math.max(activeFirst[1], p[1]),
        });
        setFirst(null);
        setPreview(null);
      }
    },
    mousemove(event) {
      if (selecting && activeFirst) setPreview([event.latlng.lat, event.latlng.lng]);
    },
  });
  useEffect(() => {
    if (bbox)
      map.fitBounds(
        [
          [bbox.south, bbox.west],
          [bbox.north, bbox.east],
        ],
        { padding: [24, 24], animate: false },
      );
  }, [bbox, fitKey, map]);
  useEffect(() => {
    map.getContainer().style.cursor = selecting ? "crosshair" : "";
  }, [map, selecting]);
  return (
    <>
      {bbox && (
        <Rectangle
          bounds={[
            [bbox.south, bbox.west],
            [bbox.north, bbox.east],
          ]}
          pathOptions={{ color: "#16818c", fillOpacity: 0.04, dashArray: "6 5", weight: 2 }}
          interactive={false}
        />
      )}
      {selecting && activeFirst && preview && (
        <Rectangle
          bounds={[activeFirst, preview]}
          pathOptions={{ color: "#e38d36", fillOpacity: 0.1 }}
          interactive={false}
        />
      )}
    </>
  );
}
export default function LabMap(props: Props) {
  const { t } = useLocale();
  const [tileError, setTileError] = useState(false);
  const normalIds = useMemo(() => new Set(props.normalRoute?.edgeIds), [props.normalRoute]);
  const currentIds = useMemo(() => new Set(props.scenarioRoute?.edgeIds), [props.scenarioRoute]);
  const markers =
    props.snapshot?.network.nodes.filter(
      (n) =>
        n.type !== "intersection" &&
        (props.showFacilities || n.type === "residential" || n.type === "commercial"),
    ) ?? [];
  return (
    <div className="real-map-wrap" data-testid="real-map">
      <MapContainer
        center={[34.6665, 133.934]}
        zoom={14}
        className="real-map"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
          eventHandlers={{ tileerror: () => setTileError(true) }}
        />
        <Selection
          bbox={props.bbox}
          selecting={props.selecting}
          fitKey={props.fitKey}
          onBounds={props.onBounds}
        />
        {props.snapshot?.network.edges
          .filter((e) => e.osm && (!props.bridgesOnly || e.osm.bridge))
          .map((edge) => {
            const state = props.current?.edgeStates[edge.id];
            const closed = state ? !state.available : false;
            const selected = props.selectedId === edge.id || props.highlightedId === edge.id;
            const trafficColor = closed
              ? "#cc4737"
              : selected
                ? "#e28d35"
                : (state?.utilization ?? 0) > 1
                  ? "#d58a35"
                  : "#168b9b";
            const color = decisionEdgeColor(
              props.analysisLayer ?? "traffic",
              !closed,
              trafficColor,
              props.critical?.find((item) => item.edgeId === edge.id)?.score,
              Math.max(0, ...(props.critical ?? []).map((item) => item.score)),
              ((state?.utilization ?? 0) -
                (props.baseline?.edgeStates[edge.id]?.utilization ?? 0)) *
                100,
              "#cc4737",
            );
            return (
              <Polyline
                key={`${edge.id}:${closed}`}
                positions={edge.geometry!}
                className={`real-road road-${edge.id} ${closed ? "closed-edge" : ""}`}
                pathOptions={{
                  color,
                  weight: selected
                    ? 7
                    : closed
                      ? 4
                      : props.showFlow
                        ? Math.min(7, 2 + (state?.utilization ?? 0) * 2)
                        : 3,
                  opacity: 0.85,
                  dashArray: closed ? "7 5" : undefined,
                }}
                eventHandlers={{
                  click: () => {
                    if (!props.selecting) props.onSelect(edge.id);
                  },
                }}
              >
                <Tooltip sticky>
                  {edge.name} · {t(closed ? "Closed" : "Available")}
                  {edge.osm?.oneway ? " →" : " ↔"}
                </Tooltip>
              </Polyline>
            );
          })}
        {props.showRoutes &&
          props.snapshot?.network.edges
            .filter((e) => normalIds.has(e.id))
            .map((e) => (
              <Polyline
                key={`before-${e.id}`}
                positions={e.geometry!}
                interactive={false}
                pathOptions={{ color: "#718497", weight: 8, opacity: 0.6, dashArray: "7 6" }}
              />
            ))}
        {props.showRoutes &&
          props.snapshot?.network.edges
            .filter((e) => currentIds.has(e.id))
            .map((e) => (
              <Polyline
                key={`after-${e.id}`}
                positions={e.geometry!}
                interactive={false}
                pathOptions={{ color: "#16374c", weight: 4, opacity: 1 }}
              />
            ))}
        {markers.map((n) => (
          <CircleMarker
            key={n.id}
            center={[n.latitude, n.longitude]}
            radius={n.type === "residential" ? 4 : 6}
            pathOptions={{
              color:
                n.type === "hospital" ? "#c55247" : n.type === "shelter" ? "#4a8d64" : "#16374c",
              fillColor: "#fff",
              fillOpacity: 0.95,
              weight: 2,
            }}
          >
            <Tooltip>
              {n.name} · {t(n.type)} · {t(n.district)}
              {n.type === "residential"
                ? ` · ${t("Demand proxy")}: ${n.populationWeight.toFixed(1)}`
                : ""}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
      {(!props.analysisLayer || props.analysisLayer === "traffic") && (
        <div className="real-map-legend">
          <span>
            <i className="legend-road" />
            {t("Roads")}
          </span>
          <span>
            <i className="legend-closed" />
            {t("Closed")}
          </span>
          <span>
            <i className="legend-busy" />
            {t("High modeled utilization")}
          </span>
          <span>{t("Circles · modeled origins & essential facilities")}</span>
          {props.showRoutes && (
            <>
              <span>
                <i className="legend-baseline-route" />
                {t("Baseline route")}
              </span>
              <span>
                <i className="legend-scenario-route" />
                {t("Scenario route")}
              </span>
            </>
          )}
        </div>
      )}
      {props.selecting && (
        <div className="selection-note">
          {t("Click two opposite corners to select a rectangle.")}
        </div>
      )}
      {tileError && (
        <p className="tile-error">
          {t("Some background tiles are unavailable. The network analysis remains usable.")}
        </p>
      )}
    </div>
  );
}
