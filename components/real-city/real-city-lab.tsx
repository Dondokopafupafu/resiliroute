"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Download,
  Focus,
  Globe2,
  LoaderCircle,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { LanguageSwitch, useLocale } from "@/components/locale-provider";
import { ModeSwitch } from "@/components/mode-switch";
import { DecisionMapControls, CriticalityDetail } from "@/components/decision-map-controls";
import { DecisionBoundary } from "@/components/decision-boundary";
import type { DecisionMapLayer, DecisionMapView } from "@/lib/decision/map-style";
import { Logo, Methodology, Modal } from "@/components/ui";
import { MetricCards } from "@/components/dashboard/metric-cards";
import { ImpactCharts } from "@/components/charts/impact-charts";
import { CriticalAnalysis } from "@/components/dashboard/critical-analysis";
import { EssentialServices } from "@/components/dashboard/essential-services";
import { ResilienceBrief } from "@/components/ai/resilience-brief";
import { generateLocalAnalysis, isAIAnalysis } from "@/lib/ai/analysis";
import { areaDimensions, ImportError, validateBoundingBox } from "@/lib/osm/geo";
import { validateSnapshot } from "@/lib/real-city/snapshot";
import { requestRealCityNetwork } from "@/lib/real-city/network-request";
import { buildFromOSMFile } from "@/lib/real-city/import-file-client";
import { osmExportUrl } from "@/lib/real-city/location-input";
import { LocationPicker } from "./location-picker";
import { exampleAreas, realCityConfig } from "@/lib/real-city/model-config";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";
import { realCityContext } from "@/lib/real-city/context";
import { NetworkSummary, DataProvenance } from "./data-provenance";
import { RoadControls } from "./road-controls";
import type { BoundingBox, ImportErrorCode, RealCityNetwork } from "@/types/real-city";
import type { SimulationResult } from "@/types/network";
import type { LabAnalysis, WorkerResponse } from "@/lib/real-city/analysis-worker";
import type { AnalysisResponse } from "@/types/analysis";

const LabMap = dynamic(() => import("./lab-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Globe2 size={30} />
    </div>
  ),
});
const DecisionWorkspace = dynamic(() => import("../decision/decision-workspace"), { ssr: false });
const errors: Record<ImportErrorCode, string> = {
  INVALID_BBOX: "Select a valid rectangle with two opposite corners.",
  AREA_TOO_LARGE:
    "Selected area is too large. Choose an area smaller than 25 km² for interactive analysis.",
  TOO_COMPLEX: "This area contains too many roads for interactive analysis. Select a smaller area.",
  EMPTY_ROADS: "No usable connected road network was found. Select another area.",
  INVALID_RESPONSE: "OpenStreetMap returned incomplete data. Try again or choose another area.",
  UPSTREAM_UNAVAILABLE:
    "OpenStreetMap is temporarily unavailable. Try again, import a snapshot, or use Demo City.",
  SERVER_UNREACHABLE:
    "Cannot reach the ResiliRoute server. Check your connection and, if running locally, make sure the app server is running. Then retry.",
  TIMEOUT: "The road request timed out. Try a smaller area or import a saved snapshot.",
  CANCELLED: "Network build cancelled.",
  RATE_LIMIT: "The data service is busy. Wait a few minutes or use a saved snapshot.",
  INVALID_SNAPSHOT: "This snapshot is invalid or uses an unsupported model version.",
  INVALID_OSM_FILE:
    "This file is not complete OSM XML or Overpass JSON. Export a small area with its road nodes and try again.",
};
const disclaimer =
  "Road geometry and facilities come from OpenStreetMap. Traffic capacity and demand are modeled estimates. ResiliRoute is an educational planning prototype, not real-time traffic or emergency navigation.";

export default function RealCityLab() {
  const { t, locale } = useLocale();
  const [bbox, setBbox] = useState<BoundingBox | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [selectionKey, setSelectionKey] = useState(0);
  const [snapshot, setSnapshot] = useState<RealCityNetwork | null>(null);
  const [source, setSource] = useState("Live OpenStreetMap import");
  const [fetching, setFetching] = useState(false);
  const [fetchKind, setFetchKind] = useState<"live" | "snapshot" | "file">("live");
  const [error, setError] = useState<ImportErrorCode | null>(null);
  const [closedIds, setClosedIds] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [bridgesOnly, setBridgesOnly] = useState(false);
  const [showFacilities, setShowFacilities] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showFlow, setShowFlow] = useState(true);
  const [mapLayer, setMapLayer] = useState<DecisionMapLayer>("traffic");
  const [mapView, setMapView] = useState<DecisionMapView>("after");
  const [networkGeneration, setNetworkGeneration] = useState(0);
  const [methodology, setMethodology] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [aiRefresh, setAiRefresh] = useState(0);
  const [cloudAvailable, setCloudAvailable] = useState(false);
  const [cloudAI, setCloudAI] = useState(false);
  const [view, setView] = useState<{
    snapshot: RealCityNetwork;
    key: string;
    baseline: SimulationResult;
    current: SimulationResult;
  } | null>(null);
  const [analysis, setAnalysis] = useState<{
    snapshot: RealCityNetwork;
    key: string;
    result: LabAnalysis;
  } | null>(null);
  const [progress, setProgress] = useState<Extract<WorkerResponse, { type: "progress" }> | null>(
    null,
  );
  const [remote, setRemote] = useState<{
    snapshot: RealCityNetwork;
    key: string;
    result: AnalysisResponse;
  } | null>(null);
  const request = useRef<AbortController | null>(null);
  const baselineCache = useRef<{ snapshot: RealCityNetwork; baseline: SimulationResult } | null>(
    null,
  );
  const signature = closedIds.join(",") + `:${refresh}`;
  const currentView = view?.snapshot === snapshot && view.key === signature ? view : null;
  // Keep the decision workspace mounted during recalculation; its controls are disabled.
  const retainedView = view?.snapshot === snapshot ? view : null;
  const result =
    analysis?.snapshot === snapshot && analysis.key === signature ? analysis.result : null;
  const working = fetching || (!!snapshot && !result && !error);
  let bboxError: ImportErrorCode | null = null;
  if (bbox) {
    try {
      validateBoundingBox(bbox);
    } catch (e) {
      bboxError = e instanceof ImportError ? e.code : "INVALID_BBOX";
    }
  }
  // A partially edited number is valid form state, but never valid Leaflet input.
  const drawableBbox = bboxError === "INVALID_BBOX" ? null : bbox;
  const dimensions = drawableBbox ? areaDimensions(drawableBbox) : null;

  useEffect(() => {
    if (!snapshot) return;
    const worker = new Worker(new URL("../../lib/real-city/analysis-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      if (message.type === "progress") setProgress(message);
      if (message.type === "current") {
        baselineCache.current = { snapshot, baseline: message.baseline };
        setView({ snapshot, key: signature, ...message });
      }
      if (message.type === "complete") {
        setAnalysis({ snapshot, key: signature, result: message.result });
        setProgress(null);
      }
      if (message.type === "error") {
        setError("INVALID_SNAPSHOT");
        setProgress(null);
      }
    };
    worker.onerror = () => {
      setError("INVALID_SNAPSHOT");
      setProgress(null);
    };
    worker.postMessage({
      snapshot,
      closedIds,
      baseline:
        baselineCache.current?.snapshot === snapshot ? baselineCache.current.baseline : undefined,
    });
    return () => worker.terminate();
  }, [snapshot, closedIds, signature]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/analysis/real-city", { signal: controller.signal })
      .then((r) => r.json())
      .then((body: unknown) => {
        if (body && typeof body === "object" && "enabled" in body)
          setCloudAvailable(body.enabled === true);
      })
      .catch(() => {
        /* Local analyst remains fully available. */
      });
    return () => controller.abort();
  }, []);

  const route = useMemo(() => {
    if (!snapshot || !currentView || !origin || !destination) return { before: null, after: null };
    return {
      before: shortestPath(
        buildGraph(snapshot.network),
        origin,
        destination,
        (e) => currentView.baseline.edgeStates[e.id].travelTime,
      ),
      after: shortestPath(
        buildGraph(snapshot.network, closedIds),
        origin,
        destination,
        (e) => currentView.current.edgeStates[e.id].travelTime,
      ),
    };
  }, [snapshot, currentView, origin, destination, closedIds]);
  const resultBaseline = result?.baseline,
    resultCurrent = result?.current,
    resultRanking = result?.ranking,
    resultRecovery = result?.recovery,
    resultScreening = result?.screening;
  const context = useMemo(() => {
    if (
      !snapshot ||
      !resultBaseline ||
      !resultCurrent ||
      !resultRanking ||
      !resultRecovery ||
      !resultScreening
    )
      return null;
    return realCityContext(
      snapshot,
      resultBaseline,
      resultCurrent,
      resultRanking,
      resultRecovery,
      resultScreening,
    );
  }, [snapshot, resultBaseline, resultCurrent, resultRanking, resultRecovery, resultScreening]);
  const aiKey = `${signature}:${locale}:${aiRefresh}`;
  useEffect(() => {
    if (!snapshot || !context || !cloudAI) return;
    const controller = new AbortController();
    fetch("/api/analysis/real-city", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot, closedEdgeIds: closedIds, locale }),
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) return;
        const data: unknown = await r.json();
        if (
          data &&
          typeof data === "object" &&
          "analysis" in data &&
          isAIAnalysis(data.analysis) &&
          "source" in data &&
          (data.source === "local" || data.source === "openai")
        )
          setRemote({
            snapshot,
            key: aiKey,
            result: { analysis: data.analysis, source: data.source },
          });
      })
      .catch(() => {
        /* Calculated local brief remains available. */
      });
    return () => controller.abort();
  }, [snapshot, context, closedIds, locale, aiKey, cloudAI]);

  const installSnapshot = (data: RealCityNetwork, label: string) => {
    setNetworkGeneration((generation) => generation + 1);
    setMapView("after");
    setMapLayer("traffic");
    setSnapshot(data);
    setBbox(data.bbox);
    setSource(label);
    setClosedIds([]);
    setSelectedId(null);
    setHighlightedId(null);
    setProgress(null);
    setError(null);
    setSelecting(false);
    setFitKey((k) => k + 1);
    setShowRoutes(false);
    setBridgesOnly(false);
    setOrigin(data.network.nodes.find((n) => n.type === "residential")?.id ?? "");
    setDestination(
      data.network.nodes.find(
        (n) => n.type === "hospital" || n.type === "station" || n.type === "commercial",
      )?.id ?? "",
    );
  };
  const build = async () => {
    if (!bbox || bboxError) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFetching(true);
    setFetchKind("live");
    setError(null);
    setSelecting(false);
    try {
      const data = await requestRealCityNetwork(bbox, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      installSnapshot(
        data.snapshot,
        data.cached ? "Cached OpenStreetMap import" : "Live OpenStreetMap import",
      );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof ImportError ? e.code : "UPSTREAM_UNAVAILABLE");
    } finally {
      if (request.current === controller && !controller.signal.aborted) setFetching(false);
    }
  };
  const cancel = () => {
    request.current?.abort();
    setFetching(false);
    setError("CANCELLED");
  };
  const reset = () => {
    setMapLayer("traffic");
    setMapView("after");
    setClosedIds([]);
    setSelectedId(null);
    setHighlightedId(null);
    setError(null);
    setShowRoutes(false);
    setRefresh((n) => n + 1);
  };
  const shrinkArea = () => {
    if (!bbox || fetching) return;
    const latitudeMargin = (bbox.north - bbox.south) / 4;
    const longitudeMargin = (bbox.east - bbox.west) / 4;
    setBbox({
      south: bbox.south + latitudeMargin,
      north: bbox.north - latitudeMargin,
      west: bbox.west + longitudeMargin,
      east: bbox.east - longitudeMargin,
    });
    setSelecting(false);
    setError(null);
    setFitKey((k) => k + 1);
  };
  const toggle = (id: string) => {
    if (working) return;
    if (!closedIds.includes(id) && closedIds.length >= realCityConfig.maxClosures) return;
    setError(null);
    setMapView("after");
    setClosedIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id].sort()));
  };
  const exportSnapshot = () => {
    if (!snapshot) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(validateSnapshot(snapshot), null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "resiliroute-real-city-snapshot.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importSnapshot = async (file?: File) => {
    if (!file) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFetching(true);
    setFetchKind("snapshot");
    setError(null);
    try {
      if (file.size > realCityConfig.maxSnapshotBytes) throw new ImportError("INVALID_SNAPSHOT");
      const text = await file.text();
      if (controller.signal.aborted || request.current !== controller) return;
      installSnapshot(
        validateSnapshot(JSON.parse(text)),
        "Imported snapshot · provenance supplied by file",
      );
    } catch {
      if (!controller.signal.aborted) setError("INVALID_SNAPSHOT");
    } finally {
      if (request.current === controller && !controller.signal.aborted) setFetching(false);
    }
  };
  const loadSavedSample = async (name: string) => {
    if (!["okayama", "matsumoto"].includes(name)) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFetching(true);
    setFetchKind("snapshot");
    setError(null);
    try {
      const response = await fetch(`/real-city/${name}.json`, { signal: controller.signal });
      if (!response.ok) throw new Error("Sample unavailable");
      const data: unknown = await response.json();
      if (controller.signal.aborted || request.current !== controller) return;
      installSnapshot(validateSnapshot(data), "Saved actual OSM sample · captured 10 Oct 2026");
    } catch {
      if (!controller.signal.aborted) setError("INVALID_SNAPSHOT");
    } finally {
      if (request.current === controller && !controller.signal.aborted) setFetching(false);
    }
  };
  const importOSM = async (file?: File) => {
    if (!file) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setFetching(true);
    setFetchKind("file");
    setError(null);
    setSelecting(false);
    try {
      const data = await buildFromOSMFile(file, bboxError ? null : bbox, controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      installSnapshot(data, "Imported OSM file · provenance supplied by file");
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof ImportError && e.code !== "INVALID_RESPONSE" ? e.code : "INVALID_OSM_FILE",
        );
    } finally {
      if (request.current === controller && !controller.signal.aborted) setFetching(false);
    }
  };
  const progressName = fetching
    ? fetchKind === "live"
      ? "Fetching roads & building the intersection graph"
      : fetchKind === "file"
        ? "Building network from your OSM file"
        : "Reading saved network snapshot"
    : progress?.step === "baseline"
      ? "Running baseline simulation"
      : progress?.step === "assignment"
        ? "Redistributing modeled demand"
        : progress?.step === "criticality"
          ? "Stress-testing road closures"
          : "Comparing recovery priorities";
  return (
    <div className="app-shell real-city-shell">
      <a className="skip-link" href="#real-workspace">
        {t("Skip to simulation")}
      </a>
      <header className="site-header">
        <Link href="/" className="logo-link" aria-label={t("ResiliRoute home")}>
          <Logo />
        </Link>
        <nav aria-label={t("Main navigation")}>
          <ModeSwitch mode="real" />
          <button onClick={() => setMethodology(true)}>{t("Methodology")}</button>
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          <button className="button button-reset" disabled={!snapshot || fetching} onClick={reset}>
            <RotateCcw size={14} />
            {t("Reset closures")}
          </button>
        </div>
      </header>
      <main>
        <section className={`real-hero ${snapshot ? "real-hero-ready" : ""}`}>
          <div>
            <span className="eyebrow">{t("RESILIROUTE 3.0 · REAL CITY LAB")}</span>
            <h1>
              {t("From a synthetic city")}
              <br />
              <span>{t("to any city.")}</span>
            </h1>
            <p>{t("Select an area. Build its mobility network. Stress-test its resilience.")}</p>
          </div>
          <div className="real-steps">
            <span>
              <b>01</b>
              {t("Select")}
            </span>
            <ArrowRight />
            <span>
              <b>02</b>
              {t("Build")}
            </span>
            <ArrowRight />
            <span>
              <b>03</b>
              {t("Stress-test")}
            </span>
            <small>{t("Real infrastructure geometry + modeled mobility demand")}</small>
          </div>
        </section>
        <p className="real-disclaimer">
          <Globe2 size={16} />
          {t(disclaimer)}
        </p>
        {snapshot && (
          <div className="real-kpi-strip">
            {currentView ? (
              <MetricCards
                before={currentView.baseline.metrics}
                after={currentView.current.metrics}
                modeledDemand
                accessibilityAvailable={!!snapshot.network.accessibilityCategories?.length}
              />
            ) : (
              <p role="status">{t("Redistributing modeled demand")}</p>
            )}
            {working && (
              <p className="real-global-progress" role="status">
                {t(progressName)}{" "}
                {progress?.step === "criticality"
                  ? `${progress.completed} / ${progress.total}`
                  : ""}
              </p>
            )}
          </div>
        )}
        <section key="real-workspace" id="real-workspace" className="real-workspace">
          <div className="real-map-column">
            <div className="real-map-toolbar">
              <strong>{t(snapshot ? "Real City Lab" : "Select an Analysis Area")}</strong>
              <button
                className="icon-button"
                aria-label={t("Fit network to map")}
                onClick={() => setFitKey((k) => k + 1)}
              >
                <Focus size={18} />
              </button>
            </div>
            {snapshot && (
              <DecisionMapControls
                layer={mapLayer}
                view={mapView}
                onLayer={setMapLayer}
                onView={setMapView}
                tested={result?.ranking.length ?? 0}
                total={snapshot.network.edges.filter((edge) => edge.osm).length}
              />
            )}
            <LabMap
              bbox={drawableBbox}
              snapshot={snapshot}
              current={
                mapView === "before"
                  ? (retainedView?.baseline ?? null)
                  : (retainedView?.current ?? null)
              }
              baseline={retainedView?.baseline}
              analysisLayer={mapView === "before" ? "traffic" : mapLayer}
              critical={result?.ranking ?? []}
              selecting={selecting}
              selectionKey={selectionKey}
              fitKey={fitKey}
              onBounds={(b) => {
                setBbox(b);
                setSelecting(false);
                setError(null);
              }}
              onSelect={setSelectedId}
              selectedId={selectedId}
              highlightedId={highlightedId}
              bridgesOnly={bridgesOnly}
              showFacilities={showFacilities}
              showRoutes={showRoutes}
              showFlow={showFlow}
              normalRoute={route.before}
              scenarioRoute={mapView === "before" ? route.before : route.after}
            />
            {mapLayer === "criticality" && mapView === "after" && (
              <CriticalityDetail selected={selectedId} critical={result?.ranking ?? []} />
            )}
            {snapshot && (
              <div className="real-layers" role="group" aria-label={t("Map layers")}>
                {[
                  ["Bridges only", bridgesOnly, setBridgesOnly],
                  ["Essential facilities", showFacilities, setShowFacilities],
                  ["Route overlay", showRoutes, setShowRoutes],
                  ["Traffic flow", showFlow, setShowFlow],
                ].map(([label, checked, setter]) => (
                  <label key={String(label)}>
                    <input
                      type="checkbox"
                      checked={Boolean(checked)}
                      onChange={(e) => (setter as (checked: boolean) => void)(e.target.checked)}
                    />
                    {t(String(label))}
                  </label>
                ))}
              </div>
            )}
            {snapshot && <NetworkSummary snapshot={snapshot} source={source} />}
          </div>
          <aside className="real-side">
            <article className="panel area-panel">
              <details className="area-builder" open={!snapshot}>
                <summary>
                  {t(snapshot ? "Change analysis area" : "Select an Analysis Area")}
                </summary>
                <span className="eyebrow">{t("START WITH AN AREA")}</span>
                <h2>{t("Analyze a real urban network")}</h2>
                <p>
                  {t(
                    "Any mapped region, not just the examples. Zoom out, drag to your location, then zoom in and select two opposite corners.",
                  )}
                </p>
                <LocationPicker
                  disabled={fetching}
                  onChoose={(b) => {
                    setBbox(b);
                    setFitKey((k) => k + 1);
                    setSelecting(false);
                    setError(null);
                  }}
                />
                <button
                  className="button button-primary"
                  disabled={fetching}
                  onClick={() => {
                    setSelecting((p) => !p);
                    setSelectionKey((k) => k + 1);
                  }}
                >
                  {t(selecting ? "Cancel selection" : "Select area on map")}
                </button>
                <label className="field-label" htmlFor="example-area">
                  {t("Try an example area")}
                </label>
                <select
                  id="example-area"
                  value=""
                  disabled={fetching}
                  onChange={(e) => {
                    const example = exampleAreas[Number(e.target.value)];
                    if (example) {
                      setBbox({ ...example.bbox });
                      setFitKey((k) => k + 1);
                      setSelecting(false);
                      setError(null);
                    }
                  }}
                >
                  <option value="">{t("Choose an area…")}</option>
                  {exampleAreas.map((e, i) => (
                    <option key={e.name} value={i}>
                      {t(e.name)}
                    </option>
                  ))}
                </select>
                <label className="field-label" htmlFor="saved-area">
                  {t("Load a saved OSM example (no API)")}
                </label>
                <select
                  id="saved-area"
                  value=""
                  disabled={working}
                  onChange={(e) => void loadSavedSample(e.target.value)}
                >
                  <option value="">{t("Choose an area…")}</option>
                  <option value="okayama">{t("Okayama · riverside")}</option>
                  <option value="matsumoto">{t("Matsumoto · central")}</option>
                </select>
                <details className="bbox-inputs">
                  <summary>{t("Edit bounding coordinates")}</summary>
                  {["south", "west", "north", "east"].map((key) => (
                    <label key={key}>
                      {t(key)}
                      <input
                        type="number"
                        step="0.001"
                        value={
                          Number.isFinite(bbox?.[key as keyof BoundingBox])
                            ? bbox?.[key as keyof BoundingBox]
                            : ""
                        }
                        onChange={(e) =>
                          setBbox((b) => ({
                            ...(b ?? { ...exampleAreas[0].bbox }),
                            [key]: e.target.value === "" ? NaN : Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  ))}
                </details>
                {bbox && (
                  <div className="area-stats">
                    <div>
                      <span>{t("Width")}</span>
                      <strong>{dimensions?.width.toFixed(2) ?? "—"} km</strong>
                    </div>
                    <div>
                      <span>{t("Height")}</span>
                      <strong>{dimensions?.height.toFixed(2) ?? "—"} km</strong>
                    </div>
                    <div>
                      <span>{t("Approx. area")}</span>
                      <strong>{dimensions?.area.toFixed(2) ?? "—"} km²</strong>
                    </div>
                  </div>
                )}
                <p className="table-note">{t("Recommended: 1–10 km² · maximum: 25 km²")}</p>
                {bboxError && (
                  <p role="alert" className="real-error">
                    {t(errors[bboxError])}
                  </p>
                )}
                <button
                  className="button demo-button build-network"
                  disabled={!bbox || !!bboxError || working}
                  onClick={build}
                  data-testid="build-network"
                >
                  {working ? <LoaderCircle size={17} className="spin" /> : <Globe2 size={17} />}
                  {t("Build Mobility Network")}
                </button>
                {working && (
                  <div className="build-progress" role="status">
                    <strong>{t(progressName)}</strong>
                    {progress?.step === "criticality" && (
                      <>
                        <progress value={progress.completed} max={progress.total} />
                        <span>
                          {progress.completed} / {progress.total}
                        </span>
                      </>
                    )}
                    <small>{t("Processing actual data and model calculations")}</small>
                    {fetching && (
                      <button className="text-button" onClick={cancel}>
                        <X size={14} />
                        {t("Cancel")}
                      </button>
                    )}
                  </div>
                )}
              </details>
              <details className="osm-file-import">
                <summary>{t("Use your own OSM data file")}</summary>
                <p className="table-note">
                  {t(
                    "If live import is unavailable, export a small area as OSM XML on OpenStreetMap, then import it here. The file is processed locally. No API key is needed.",
                  )}
                </p>
                <a
                  className="text-button"
                  href={
                    bbox && !bboxError ? osmExportUrl(bbox) : "https://www.openstreetmap.org/export"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t("Open OpenStreetMap export")}
                </a>
                <label className="button button-secondary osm-file-button">
                  <Upload size={14} />
                  {t("Import OSM file")}
                  <input
                    type="file"
                    accept=".osm,.xml,.json,application/xml,text/xml,application/json"
                    aria-label={t("Import OSM file")}
                    disabled={fetching}
                    onChange={(e) => {
                      void importOSM(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <p className="table-note">
                  {t(
                    "OSM XML or Overpass JSON · up to 10 MB. XML file bounds replace the selection. For JSON without bounds, select the matching area first. Incomplete files may omit facilities.",
                  )}
                </p>
              </details>
              {error && (
                <div className="real-error" role="alert">
                  <p>{t(errors[error])}</p>
                  {["UPSTREAM_UNAVAILABLE", "RATE_LIMIT", "TIMEOUT", "SERVER_UNREACHABLE"].includes(
                    error,
                  ) && (
                    <p>
                      {t(
                        "This is a data-service issue, not a restriction to example cities. You can also use your own OSM data file above.",
                      )}
                    </p>
                  )}
                  {bbox && (error === "TOO_COMPLEX" || error === "TIMEOUT") && (
                    <>
                      <button
                        className="button button-secondary"
                        onClick={shrinkArea}
                        disabled={fetching}
                      >
                        {t("Shrink selected area")}
                      </button>
                      <p className="table-note">
                        {t(
                          "Halve the width and height, then build again. No roads are fetched until you press Build.",
                        )}
                      </p>
                    </>
                  )}
                  <Link href="/" className="button button-secondary">
                    {t("Use Demo City Instead")}
                  </Link>
                </div>
              )}
              <div className="snapshot-actions">
                <button
                  className="button button-secondary"
                  disabled={!snapshot || fetching}
                  onClick={exportSnapshot}
                >
                  <Download size={14} />
                  {t("Export Network Snapshot")}
                </button>
                <label className="button button-secondary">
                  <Upload size={14} />
                  {t("Import Snapshot")}
                  <input
                    aria-label={t("Import Snapshot")}
                    type="file"
                    accept=".json,application/json"
                    disabled={fetching}
                    onChange={(e) => {
                      void importSnapshot(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <p className="table-note">
                {t(
                  "Snapshots reproduce the network and baseline offline. Imported provenance is not independently verified.",
                )}
              </p>
            </article>
            {snapshot && (
              <RoadControls
                snapshot={snapshot}
                current={currentView?.current ?? null}
                selectedId={selectedId}
                closedIds={closedIds}
                onSelect={setSelectedId}
                onToggle={toggle}
                onReset={reset}
                busy={working}
                origin={origin}
                destination={destination}
                onOrigin={(id) => {
                  setOrigin(id);
                  setShowRoutes(true);
                }}
                onDestination={(id) => {
                  setDestination(id);
                  setShowRoutes(true);
                }}
                beforeRoute={route.before}
                afterRoute={route.after}
              />
            )}
          </aside>
        </section>
        {snapshot && retainedView && (
          <DecisionBoundary key={networkGeneration}>
            <DecisionWorkspace
              network={snapshot.network}
              odPairs={snapshot.odPairs}
              baseline={retainedView.baseline}
              current={retainedView.current}
              critical={result?.ranking ?? []}
              networkLabel={source}
              realCity
              bbox={snapshot.bbox}
              selectedEdgeId={selectedId}
              busy={working || !currentView}
              onApplyClosures={(ids) => {
                if (working) return;
                const valid = [...new Set(ids)].filter((id) =>
                  snapshot.network.edges.some((edge) => edge.id === id && edge.osm),
                );
                if (valid.length > realCityConfig.maxClosures) return;
                setError(null);
                setClosedIds(valid.sort());
                setMapView("after");
              }}
              onHighlightEdge={(id) => {
                setHighlightedId(id);
                setSelectedId(id);
              }}
              onLayerChange={(layer) => {
                setMapLayer(layer);
                setMapView("after");
              }}
            />
          </DecisionBoundary>
        )}
        {snapshot && currentView && (
          <section className="real-impact" id="real-impact">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("CASCADING IMPACT ANALYSIS")}</span>
                <h2>{t("A real road. A network-wide consequence.")}</h2>
                <p>{t("Every comparison uses the same imported network and synthetic demand.")}</p>
              </div>
            </div>
            <p className="real-access-note">
              {t("Accessibility categories")}:{" "}
              {["hospital", "shelter", "station"]
                .map(
                  (type) =>
                    `${t(type)}: ${snapshot.network.accessibilityCategories?.includes(type as "hospital" | "shelter" | "station") ? t("Available") : t("Unavailable")}`,
                )
                .join(" · ")}
              . {t("Directional sectors are model groups, not administrative districts.")}
            </p>
            <ImpactCharts
              baseline={currentView.baseline}
              current={currentView.current}
              accessibilityAvailable={!!snapshot.network.accessibilityCategories?.length}
            />
            <EssentialServices
              baseline={currentView.baseline}
              current={currentView.current}
              modeledDemand
            />
          </section>
        )}
        {snapshot && result && (
          <section className="real-analysis">
            <p className="screening-note">
              {result.screening.screened
                ? t(
                    "Criticality analysis screened {count} candidate links from {total} available roads",
                    { count: result.screening.ids.length, total: result.screening.total },
                  )
                : t("Full stress test: {count} available road links", {
                    count: result.screening.total,
                  })}{" "}
              · {t("Calculation time")}: {(result.elapsedMs / 1000).toFixed(2)}s
            </p>
            <CriticalAnalysis
              realCity
              candidateScreening={result.screening.screened}
              ranking={result.ranking}
              recovery={result.recovery}
              selectedEdgeId={selectedId}
              onHighlight={setHighlightedId}
              onSelect={(id) => {
                setSelectedId(id);
                document.getElementById("real-workspace")?.scrollIntoView({ behavior: "instant" });
              }}
              onRestore={toggle}
              onAnalyze={() => {
                setError(null);
                setRefresh((n) => n + 1);
              }}
              analyzing={working}
            />
            {context && (
              <div>
                <div className="cloud-ai-control">
                  <label>
                    <input
                      type="checkbox"
                      checked={cloudAI}
                      disabled={!cloudAvailable}
                      onChange={(e) => setCloudAI(e.target.checked)}
                    />
                    {t("Use optional cloud AI")}
                  </label>
                  <small>
                    {t(
                      cloudAvailable
                        ? "Enabling sends this network and modeled results to the configured AI provider."
                        : "Local evidence analyst active · cloud AI is not configured.",
                    )}
                  </small>
                </div>
                <ResilienceBrief
                  context={context}
                  analysis={
                    cloudAI && remote?.snapshot === snapshot && remote.key === aiKey
                      ? remote.result.analysis
                      : generateLocalAnalysis(context, locale)
                  }
                  source={
                    cloudAI && remote?.snapshot === snapshot && remote.key === aiKey
                      ? remote.result.source
                      : "local"
                  }
                  loading={false}
                  onRefresh={() => setAiRefresh((n) => n + 1)}
                />
              </div>
            )}
          </section>
        )}
        {snapshot && <DataProvenance snapshot={snapshot} />}
      </main>
      <footer className="real-footer">
        <span>© OpenStreetMap contributors · ODbL</span>
        <button className="text-button" onClick={() => setMethodology(true)}>
          {t("Read methodology")}
        </button>
        <span>
          {t(
            "No location permission required. Bounds are sent when building; optional cloud AI also receives the network.",
          )}
        </span>
      </footer>
      {methodology && (
        <Modal title={t("Methodology")} onClose={() => setMethodology(false)}>
          <RealCityMethodology />
          <h2>{t("Shared simulation engine · Harbor City reference")}</h2>
          <p>
            {t(
              "The following formulas are shared by both modes. The Harbor City network description refers to the synthetic demo; Real City Lab uses the imported graph and demand assumptions above.",
            )}
          </p>
          <Methodology />
        </Modal>
      )}
    </div>
  );
}
export function RealCityMethodology() {
  const { t } = useLocale();
  const paragraphs = [
    [
      "Real City Data Pipeline",
      "OpenStreetMap → road extraction → intersection graph → speed/capacity estimation → demand proxy generation → traffic assignment → resilience analysis",
    ],
    [
      "Estimated road capacity",
      "Real City Lab uses OpenStreetMap geometry and road classifications. Traffic capacity is estimated from road class and lane information and should not be interpreted as observed traffic counts.",
    ],
    [
      "Speed and direction",
      "Speeds use OSM maxspeed tags when available and road-class defaults otherwise. One-way tags, reversed one-way roads and roundabouts determine graph direction. Bidirectional roads share the sum of lane capacities; direction-specific queues are not modeled.",
    ],
    [
      "Demand and facilities",
      "Origins are deterministic spatial samples of residential roads, weighted by adjacent residential road length. This is a demand proxy, not population. Total synthetic demand equals 0.75 × median shared road capacity × sampled origin count, capped at 40,000 modeled units/hour. Nearest supported destinations generate up to 80 reachable baseline OD pairs. Facilities connect to the nearest graph node within 350 m using a modeled connector; this does not verify an entrance or safe access.",
    ],
    [
      "Accessibility and missing data",
      "Hospital/clinic: 20 minutes. Shelter: 15 minutes. Station: 12 minutes. These educational thresholds apply to the modeled demand proxy. Only imported service categories are averaged. A missing category is Unavailable; if all categories are absent, accessibility is N/A and its resilience-retention term is neutral.",
    ],
    [
      "Network boundaries and stress tests",
      "Road geometry is simplified between intersections while detailed polylines are retained. Only in-bounds runs with at least two OSM nodes are included; roads and detours outside the rectangle are excluded. All available roads are tested at 200 or fewer road links. Larger networks screen 35 candidates using assigned flow × free-flow time, bridge tags and endpoint connectivity, then run the full model on each candidate. Rankings are conditional and may miss unscreened roads. Facility connectors are excluded from closure rankings.",
    ],
    [
      "Snapshots, privacy and limitations",
      "Snapshots save model version 1.0, bounds, OSM metadata, graph, facilities and synthetic demand. No credentials are included. File-supplied provenance is not independently verified. Requests use a bounded server proxy, up to three upstream attempts and a 20-minute process cache. No location permission, coordinates in server logs, real-time traffic, disaster probability, infrastructure condition, demographic inference or safety judgment. The recommended area is 1–10 km², at most 25 km²; complexity limits can require a smaller selection.",
    ],
  ];
  return (
    <div className="methodology real-methodology">
      {paragraphs.map(([title, body]) => (
        <article key={title}>
          <h3>{t(title)}</h3>
          <p>{t(body)}</p>
        </article>
      ))}
    </div>
  );
}
