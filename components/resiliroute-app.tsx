"use client";

import { LanguageSwitch, useLocale } from "@/components/locale-provider";
import { ModeSwitch } from "@/components/mode-switch";
import { DecisionMapControls, CriticalityDetail } from "@/components/decision-map-controls";
import { DecisionBoundary } from "@/components/decision-boundary";
import type { DecisionMapLayer, DecisionMapView } from "@/lib/decision/map-style";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Expand,
  FlaskConical,
  Focus,
  GitBranch,
  Info,
  MapPin,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  X,
} from "lucide-react";
import { harborCity, odPairs } from "@/data/harbor-city";
import { scenarios, toggleClosure } from "@/data/scenarios";
import { buildGraph, shortestPath } from "@/lib/graph/shortest-path";
import { simulate } from "@/lib/simulation/simulate";
import { analyzeCriticalLinks, analyzeRecovery } from "@/lib/simulation/stress-test";
import { createAnalysisContext, generateLocalAnalysis, isAIAnalysis } from "@/lib/ai/analysis";
import { formatNumber, percentChange, signed } from "@/lib/format";
import { About, Logo, Methodology, Modal, SectionHeading } from "./ui";
import { MetricCards } from "./dashboard/metric-cards";
import { ImpactCharts } from "./charts/impact-charts";
import { ScenarioPanel } from "./scenario/scenario-panel";
import { CriticalAnalysis } from "./dashboard/critical-analysis";
import { EssentialServices } from "./dashboard/essential-services";
import { DistrictDetail } from "./dashboard/district-detail";
import { ResilienceBrief } from "./ai/resilience-brief";
import type { AnalysisResponse } from "@/types/analysis";
import type { CriticalLinkResult, EdgeId, ScenarioId } from "@/types/network";

const NetworkMap = dynamic(() => import("./map/network-map"), {
  ssr: false,
  loading: MapLoading,
});
const DecisionWorkspace = dynamic(() => import("./decision/decision-workspace"), { ssr: false });
function MapLoading() {
  const { t } = useLocale();
  return (
    <div className="map-loading">
      <GitBranch size={30} />
      <span>{t("Preparing Harbor City’s network…")}</span>
    </div>
  );
}
const baseline = simulate(harborCity, odPairs);
const steps = [
  "Normal city",
  "Disruption",
  "Links close",
  "Traffic reroutes",
  "System impact",
  "Criticality",
  "Planning brief",
];

export default function ResiliRouteApp() {
  const { t, locale } = useLocale();

  const [scenarioId, setScenarioId] = useState<ScenarioId>("normal");
  const [closedIds, setClosedIds] = useState<EdgeId[]>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<EdgeId | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<EdgeId | null>(null);
  const [origin, setOrigin] = useState("east-home");
  const [destination, setDestination] = useState("general-hospital");
  const [showRoutes, setShowRoutes] = useState(false);
  const [showFlow, setShowFlow] = useState(true);
  const [showTiles, setShowTiles] = useState(true);
  const [mapLayer, setMapLayer] = useState<DecisionMapLayer>("traffic");
  const [mapView, setMapView] = useState<DecisionMapView>("after");
  const [fitKey, setFitKey] = useState(0);
  const [modal, setModal] = useState<"methodology" | "about" | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [demoStep, setDemoStep] = useState<number | null>(null);
  const [demoRunning, setDemoRunning] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [auditedRanking, setAuditedRanking] = useState<{
    key: string;
    ranking: CriticalLinkResult[];
  } | null>(null);
  const [auditedCount, setAuditedCount] = useState<number | null>(null);
  const [remote, setRemote] = useState<{ key: string; response: AnalysisResponse } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRefresh, setAiRefresh] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const topCriticalEdge = useRef<EdgeId | null>(null);
  const briefRef = useRef<HTMLDivElement>(null);
  const signature = [...closedIds].sort().join(",");

  const current = useMemo(() => simulate(harborCity, odPairs, closedIds, baseline), [closedIds]);
  const calculatedRanking = useMemo(
    () => analyzeCriticalLinks(harborCity, odPairs, current, baseline),
    [current],
  );
  const ranking = auditedRanking?.key === signature ? auditedRanking.ranking : calculatedRanking;
  const recovery = useMemo(
    () => analyzeRecovery(harborCity, odPairs, current, baseline),
    [current],
  );
  const context = useMemo(
    () => createAnalysisContext(scenarios[scenarioId].name, baseline, current, ranking, recovery),
    [scenarioId, current, ranking, recovery],
  );
  const localAnalysis = useMemo(() => generateLocalAnalysis(context, locale), [context, locale]);
  const aiKey = `${locale}:${scenarioId}:${signature}:${aiRefresh}`;
  const activeAnalysis =
    remote?.key === aiKey ? remote.response : { analysis: localAnalysis, source: "local" as const };
  const normalRoute = useMemo(
    () =>
      shortestPath(
        buildGraph(harborCity),
        origin,
        destination,
        (edge) => baseline.edgeStates[edge.id].travelTime,
      ),
    [origin, destination],
  );
  const scenarioRoute = useMemo(
    () =>
      shortestPath(
        buildGraph(harborCity, closedIds),
        origin,
        destination,
        (edge) => current.edgeStates[edge.id].travelTime,
      ),
    [closedIds, current, origin, destination],
  );
  const mostAffected = context.mostAffectedDistrict;
  useEffect(() => {
    topCriticalEdge.current = ranking[0]?.edgeId ?? null;
  }, [ranking]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setAiLoading(true);
      fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, closedEdgeIds: closedIds, locale }),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) return;
          const body: unknown = await response.json();
          if (
            body &&
            typeof body === "object" &&
            "analysis" in body &&
            isAIAnalysis(body.analysis) &&
            "source" in body &&
            (body.source === "local" || body.source === "openai")
          )
            setRemote({ key: aiKey, response: { analysis: body.analysis, source: body.source } });
        })
        .catch(() => {
          /* The fully computed local brief remains visible. */
        })
        .finally(() => {
          if (!controller.signal.aborted) setAiLoading(false);
        });
    }, 650);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [aiKey, scenarioId, closedIds, locale]);

  const stopDemo = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setDemoRunning(false);
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const chooseScenario = (id: ScenarioId) => {
    stopDemo();
    setDemoStep(null);
    setScenarioId(id);
    setClosedIds(id === "custom" ? closedIds : [...scenarios[id].closedEdgeIds]);
    setSelectedEdgeId(null);
    setHighlightedEdgeId(null);
    setAuditedCount(null);
    setMapView("after");
  };
  const toggleEdge = (id: EdgeId) => {
    stopDemo();
    setDemoStep(null);
    setScenarioId("custom");
    setClosedIds((ids) => toggleClosure(ids, id));
    setAuditedCount(null);
  };
  const reset = () => {
    stopDemo();
    setDemoStep(null);
    setScenarioId("normal");
    setClosedIds([]);
    setSelectedEdgeId(null);
    setHighlightedEdgeId(null);
    setOrigin("east-home");
    setDestination("general-hospital");
    setShowRoutes(false);
    setShowFlow(true);
    setShowTiles(true);
    setMapLayer("traffic");
    setMapView("after");
    setFitKey((k) => k + 1);
    setAuditedCount(null);
  };
  const finishDemo = () => {
    stopDemo();
    setScenarioId("earthquake");
    setClosedIds([...scenarios.earthquake.closedEdgeIds]);
    setSelectedEdgeId("harbor-bridge");
    setDemoStep(6);
  };
  const runDemo = () => {
    reset();
    setDemoRunning(true);
    setDemoStep(0);
    const schedule = (ms: number, callback: () => void) =>
      timers.current.push(setTimeout(callback, ms));
    schedule(850, () => setDemoStep(1));
    schedule(1850, () => {
      setScenarioId("earthquake");
      setClosedIds([...scenarios.earthquake.closedEdgeIds]);
      setSelectedEdgeId("harbor-bridge");
      setDemoStep(2);
    });
    schedule(2800, () => setDemoStep(3));
    schedule(3700, () => setDemoStep(4));
    schedule(4600, () => {
      setDemoStep(5);
      setHighlightedEdgeId(topCriticalEdge.current);
    });
    schedule(5700, () => {
      setDemoStep(6);
      setDemoRunning(false);
      setHighlightedEdgeId(null);
    });
  };
  const analyzeAll = async () => {
    setAnalyzing(true);
    setAuditedCount(null);
    await new Promise<void>((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0)));
    const results = analyzeCriticalLinks(harborCity, odPairs, current, baseline);
    setAuditedRanking({ key: signature, ranking: results });
    setAnalyzing(false);
    setAuditedCount(results.length);
  };
  const selectFromRanking = (id: EdgeId) => {
    setSelectedEdgeId(id);
    document.getElementById("network-workspace")?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
      block: "start",
    });
  };
  const exportAnalysis = () => {
    const report = {
      application: "ResiliRoute",
      dataset: "Harbor City synthetic demonstration network",
      generatedAt: new Date().toISOString(),
      language: locale,
      scenario: scenarios[scenarioId].name,
      assumptions:
        "Synthetic static person-trip demand. Simplified 24-iteration BPR assignment. Not emergency guidance.",
      baseline: baseline.metrics,
      current: current.metrics,
      closedLinks: context.closedEdges,
      districts: current.districts.map((d) => ({
        ...d,
        baseline: baseline.districts.find((b) => b.district === d.district),
      })),
      essentialServices: current.services,
      criticalLinks: ranking,
      recovery: recovery.map(
        ({ edgeId, name, resilienceGain, accessibilityGain, travelTimeSaved }) => ({
          edgeId,
          name,
          resilienceGain,
          accessibilityGain,
          travelTimeSaved,
        }),
      ),
      ai: activeAnalysis,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `resiliroute-${scenarioId}-analysis.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const scrollBrief = () =>
    briefRef.current?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  const onRouteInput = (setter: (id: string) => void) => (id: string) => {
    setter(id);
    setShowRoutes(true);
  };

  return (
    <div className={`app-shell ${presentation ? "presentation-mode" : ""}`}>
      <a className="skip-link" href="#network-workspace">
        {t("Skip to simulation")}
      </a>
      <header className="site-header">
        <a href="#" aria-label={t("ResiliRoute home")} className="logo-link">
          <Logo />
        </a>
        <nav aria-label={t("Main navigation")}>
          <ModeSwitch mode="demo" />
          <a href="#network-workspace" className="nav-active">
            {t("Simulator")}
          </a>
          <button onClick={() => setModal("methodology")}>{t("Methodology")}</button>
          <button onClick={() => setModal("about")}>{t("About")}</button>
        </nav>
        <div className="header-actions">
          <LanguageSwitch />
          <span className="synthetic-badge">
            <span className="status-dot" />
            {t("SYNTHETIC DATA")}
          </span>
          <button
            className="icon-button presentation-toggle"
            aria-label={presentation ? t("Exit presentation mode") : t("Enter presentation mode")}
            aria-pressed={presentation}
            onClick={() => setPresentation((p) => !p)}
          >
            {presentation ? <X size={17} /> : <Expand size={17} />}
          </button>
          <button className="button button-reset" onClick={reset} aria-label={t("Reset")}>
            <RotateCcw size={14} />
            <span>{t("Reset")}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="eyebrow">{t("URBAN MOBILITY RESILIENCE LAB")}</span>
              <span>{t("HARBOR CITY · 01")}</span>
            </div>
            <h1>
              {t("When one link fails,")}
              <br />
              {t("how does the ")}
              <span>{t("whole city change?")}</span>
            </h1>
            <p>
              {t(
                "Stress-test a city’s mobility network. Close roads, bridges, or rail links and instantly see how travel time, accessibility, congestion, and critical infrastructure change.",
              )}
            </p>
          </div>
          <div className="hero-action">
            <button
              className="button demo-button"
              onClick={runDemo}
              disabled={demoRunning}
              data-testid="run-demo"
            >
              <Play size={16} fill="currentColor" />
              {demoRunning ? t("Demo running…") : t("Run Earthquake Demo")}
              <ArrowRight size={17} />
            </button>
            <button
              className="explore-button"
              onClick={() => {
                chooseScenario("custom");
                document
                  .getElementById("network-workspace")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {t("Explore Manually ")}
              <ArrowDown size={13} />
            </button>
            <span className="hero-action-note">{t("One failure. A citywide ripple effect.")}</span>
          </div>
        </section>
        <div className="workspace-bar">
          <div>
            <span className="workspace-dot" />
            <h2>{t("Harbor City")}</h2>
            <span className="workspace-subtitle">{t("Network sandbox")}</span>
            <span className={`scenario-badge ${closedIds.length ? "disrupted" : ""}`}>
              {t(closedIds.length ? scenarios[scenarioId].name : "Normal conditions")}
            </span>
          </div>
          <button className="text-button export-button" onClick={exportAnalysis}>
            <Download size={14} />
            {t("Export analysis")}
          </button>
        </div>
        <MetricCards before={baseline.metrics} after={current.metrics} />
        {demoStep !== null && (
          <div
            className={`demo-timeline ${demoRunning ? "running" : ""}`}
            aria-label={t("Earthquake demonstration progress")}
          >
            <div className="timeline-label">
              <Activity size={16} />
              <strong>{demoRunning ? t("LIVE DEMONSTRATION") : t("DEMO COMPLETE")}</strong>
            </div>
            <ol>
              {steps.map((step, index) => (
                <li
                  key={step}
                  className={demoStep >= index ? "done" : ""}
                  aria-current={demoStep === index ? "step" : undefined}
                >
                  <span>{demoStep > index ? <Check size={10} /> : index + 1}</span>
                  <b>{t(step)}</b>
                  {index < steps.length - 1 && <ArrowRight size={11} />}
                </li>
              ))}
            </ol>
            {demoRunning ? (
              <button className="text-button" onClick={finishDemo}>
                <SkipForward size={13} />
                {t("Skip")}
              </button>
            ) : (
              <button className="text-button" onClick={scrollBrief}>
                {t("Read brief")}
                <ArrowRight size={13} />
              </button>
            )}
          </div>
        )}
        <div className="main-grid" id="network-workspace">
          <section className="map-panel panel" aria-label={t("Interactive mobility network")}>
            <div className="map-panel-heading">
              <span>
                <GitBranch size={16} />
                <b>{t("Mobility network")}</b>
                <small>{t("24 nodes · 42 links")}</small>
              </span>
              <div className="keyboard-link-select">
                <label htmlFor="link-select">{t("Inspect link")}</label>
                <select
                  id="link-select"
                  aria-label={t("Inspect network link")}
                  value={selectedEdgeId ?? ""}
                  onChange={(e) => setSelectedEdgeId(e.target.value || null)}
                >
                  <option value="">{t("Select on map…")}</option>
                  {harborCity.edges.map((e) => (
                    <option key={e.id} value={e.id}>
                      {t(e.name)}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </div>
            </div>
            <DecisionMapControls
              layer={mapLayer}
              view={mapView}
              onLayer={setMapLayer}
              onView={setMapView}
              tested={ranking.length}
              total={harborCity.edges.length}
            />
            <div className="map-wrapper">
              <NetworkMap
                current={mapView === "before" ? baseline : current}
                baseline={baseline}
                analysisLayer={mapView === "before" ? "traffic" : mapLayer}
                critical={ranking}
                selectedEdgeId={selectedEdgeId}
                highlightedEdgeId={highlightedEdgeId}
                onSelectEdge={setSelectedEdgeId}
                normalRoute={normalRoute}
                scenarioRoute={mapView === "before" ? normalRoute : scenarioRoute}
                showRoutes={showRoutes}
                showFlow={showFlow}
                showTiles={showTiles}
                fitKey={fitKey}
                demoStep={demoStep}
              />
              <div className="map-toolbar">
                <button
                  className="map-tool"
                  onClick={() => setFitKey((k) => k + 1)}
                  aria-label={t("Fit network to map")}
                >
                  <Focus size={16} />
                </button>
                <span />
                <button
                  className="map-layer-button"
                  onClick={() => setShowTiles((t) => !t)}
                  aria-pressed={showTiles}
                >
                  {t("Basemap")}
                </button>
                <button
                  className="map-layer-button"
                  onClick={() => setShowFlow((f) => !f)}
                  aria-pressed={showFlow}
                >
                  {t("Traffic flow")}
                </button>
                <button
                  className="map-layer-button"
                  onClick={() => setShowRoutes((r) => !r)}
                  aria-pressed={showRoutes}
                >
                  {t("Route overlay")}
                </button>
              </div>
            </div>
            {mapLayer === "criticality" && mapView === "after" && (
              <CriticalityDetail selected={selectedEdgeId} critical={ranking} />
            )}
            <div className="map-footer">
              <span>
                <MapPin size={13} />
                <b>31,100</b> {t(" weighted residents")}
              </span>
              <span>
                <GitBranch size={13} />
                <b>{formatNumber(current.metrics.totalDemand, 0)}</b> {t(" person-trips / h")}
              </span>
              <span>
                <ShieldCheck size={13} />
                {current.metrics.disconnectedODPairs === 0
                  ? t("All OD pairs connected")
                  : t("{count} disconnected OD pairs", {
                      count: current.metrics.disconnectedODPairs,
                    })}
              </span>
            </div>
          </section>
          <ScenarioPanel
            scenarioId={scenarioId}
            current={current}
            selectedEdgeId={selectedEdgeId}
            onScenario={chooseScenario}
            onToggleEdge={toggleEdge}
            onSelectEdge={setSelectedEdgeId}
            onClear={() => {
              stopDemo();
              setDemoStep(null);
              setScenarioId("normal");
              setClosedIds([]);
            }}
            origin={origin}
            destination={destination}
            onOrigin={onRouteInput(setOrigin)}
            onDestination={onRouteInput(setDestination)}
            normalRoute={normalRoute}
            scenarioRoute={scenarioRoute}
            disabled={demoRunning}
          />
        </div>
        <section className="cascade-strip" aria-label={t("Cascading impact chain")}>
          <span className="cascade-title">
            <GitBranch size={18} />
            <b>{t("Cascading impact")}</b>
          </span>
          <span>
            <small>{t("01 · DISRUPTION")}</small>
            <strong>
              {closedIds.length
                ? locale === "en" && closedIds.length === 1
                  ? "1 link unavailable"
                  : t("{count} links unavailable", { count: closedIds.length })
                : t("Network intact")}
            </strong>
          </span>
          <ArrowRight size={16} />
          <span>
            <small>{t("02 · REDISTRIBUTION")}</small>
            <strong>{t(context.redistributedLink?.name ?? "Demand uses normal routes")}</strong>
          </span>
          <ArrowRight size={16} />
          <span>
            <small>{t("03 · COMMUNITY IMPACT")}</small>
            <strong>
              {closedIds.length
                ? t("{district}: {change}% trip time", {
                    district: t(mostAffected.name),
                    change: signed(
                      percentChange(mostAffected.travelTimeBefore, mostAffected.travelTimeAfter),
                      0,
                    ),
                  })
                : t("Compare a district after closure")}
            </strong>
          </span>
          <ArrowRight size={16} />
          <button
            onClick={() =>
              document
                .getElementById("recovery-analysis")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          >
            <small>{t("04 · POSSIBLE RESPONSE")}</small>
            <strong>
              {context.bestRecovery
                ? t("Restore {name}", { name: t(context.bestRecovery.name) })
                : t("Explore recovery priorities")}
              <ArrowRight size={13} />
            </strong>
          </button>
        </section>
        <DecisionBoundary>
          <DecisionWorkspace
            network={harborCity}
            odPairs={odPairs}
            baseline={baseline}
            current={current}
            critical={ranking}
            networkLabel="Harbor City"
            selectedEdgeId={selectedEdgeId}
            busy={demoRunning}
            onApplyClosures={(ids) => {
              stopDemo();
              setDemoStep(null);
              setScenarioId(ids.length ? "custom" : "normal");
              setClosedIds(
                [...new Set(ids)]
                  .filter((id) => harborCity.edges.some((edge) => edge.id === id))
                  .sort(),
              );
              setAuditedCount(null);
              setMapView("after");
            }}
            onHighlightEdge={(id) => {
              setHighlightedEdgeId(id);
              setSelectedEdgeId(id);
            }}
            onLayerChange={(layer) => {
              setMapLayer(layer);
              setMapView("after");
            }}
          />
        </DecisionBoundary>
        <section className="impact-section" id="impact-dashboard">
          <SectionHeading
            eyebrow={t("MEASURE THE RIPPLE EFFECT")}
            title={t("A local failure. A citywide impact.")}
            description={t("Compare system performance and the communities behind the average.")}
            action={
              <span className="section-status">
                <span className="status-dot" />
                {t("Calculated from {count} OD pairs", { count: odPairs.length })}
              </span>
            }
          />
          <ImpactCharts baseline={baseline} current={current} />
          <div className="district-insight">
            <span className="insight-icon">
              <MapPin size={18} />
            </span>
            <div>
              <small>{closedIds.length ? t("MOST AFFECTED DISTRICT") : t("COMMUNITY LENS")}</small>
              <p>
                {closedIds.length ? (
                  <>
                    <b>{t(mostAffected.name)}</b> {t(" · average travel")}{" "}
                    {formatNumber(mostAffected.travelTimeBefore)} →{" "}
                    <strong>
                      {formatNumber(mostAffected.travelTimeAfter)} {t(" min")}
                    </strong>{" "}
                    {t(" · essential access ")}
                    {formatNumber(mostAffected.accessibilityBefore, 0)} →{" "}
                    <strong>{formatNumber(mostAffected.accessibilityAfter, 0)}%</strong>
                  </>
                ) : (
                  t(
                    "Citywide averages can hide unequal access. Run a disruption to reveal which community bears the greatest modeled impact.",
                  )
                )}
              </p>
            </div>
            <span className="insight-badge">
              {closedIds.length
                ? t("{change} access pts", {
                    change: signed(
                      mostAffected.accessibilityAfter - mostAffected.accessibilityBefore,
                      0,
                    ),
                  })
                : t("5 districts")}
            </span>
          </div>
          <DistrictDetail baseline={baseline} current={current} />
        </section>
        <section className="infrastructure-section">
          <SectionHeading
            eyebrow={t("ANALYZE • PRIORITIZE • RECOVER")}
            title={t("See the weak points. Explore the response.")}
            description={t("Stress-test the next failure, then compare the benefit of one repair.")}
            action={
              <span className="section-status">
                <FlaskConical size={14} />
                {t("Every link is simulated")}
              </span>
            }
          />
          <CriticalAnalysis
            ranking={ranking}
            recovery={recovery}
            selectedEdgeId={selectedEdgeId}
            onHighlight={setHighlightedEdgeId}
            onSelect={selectFromRanking}
            onRestore={toggleEdge}
            onAnalyze={analyzeAll}
            analyzing={analyzing}
          />
          <p className="audit-status" role="status">
            {auditedCount !== null &&
              t("{count} available links analyzed against the current scenario.", {
                count: auditedCount,
              })}
          </p>
          <EssentialServices baseline={baseline} current={current} />
        </section>
        <div ref={briefRef}>
          <ResilienceBrief
            analysis={activeAnalysis.analysis}
            context={context}
            source={activeAnalysis.source}
            loading={aiLoading}
            onRefresh={() => setAiRefresh((i) => i + 1)}
          />
        </div>
        <div className="responsible-notice">
          <Info size={17} />
          <p>
            <strong>{t("A model for understanding, not emergency navigation.")}</strong>{" "}
            {t(
              " Harbor City uses synthetic mobility data and a simplified traffic model. Follow official local guidance during an actual emergency.",
            )}
          </p>
          <button className="text-button" onClick={() => setModal("methodology")}>
            {t("Read methodology")}
            <ArrowRight size={13} />
          </button>
        </div>
      </main>
      <footer className="site-footer">
        <Logo compact />
        <span>{t("Built to understand resilience before disruption.")}</span>
        <span>{t("ImpactHack 2026 · Solo student project")}</span>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {t(scenarios[scenarioId].name)}
        {t(". Average travel time")} {formatNumber(current.metrics.averageTravelTime)}{" "}
        {t(" minutes. Accessibility")} {formatNumber(current.metrics.accessibility)}{" "}
        {t(" percent. Resilience")} {formatNumber(current.metrics.resilienceScore)}{" "}
        {t(" out of 100.")}
      </div>
      {modal && (
        <Modal
          title={
            modal === "methodology"
              ? t("How ResiliRoute calculates impact")
              : t("About ResiliRoute")
          }
          onClose={() => setModal(null)}
        >
          {modal === "methodology" ? <Methodology /> : <About />}
        </Modal>
      )}
      {presentation && (
        <div className="presentation-banner">
          <span>
            <Expand size={14} />
            {t("Presentation mode")}
          </span>
          <button onClick={() => setPresentation(false)}>
            {t("Exit ")}
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}
