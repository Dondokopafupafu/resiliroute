"use client";

import { useLocale } from "@/components/locale-provider";
import {
  ArrowDownRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronRight,
  LoaderCircle,
  MapPin,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { formatNumber, signed } from "@/lib/format";
import type { AIAnalysis, AnalysisContext } from "@/types/analysis";

export function ResilienceBrief({
  analysis,
  context,
  source,
  loading,
  onRefresh,
}: {
  analysis: AIAnalysis;
  context: AnalysisContext;
  source: "local" | "openai";
  loading: boolean;
  onRefresh: () => void;
}) {
  const { t } = useLocale();
  const realCity = !!context.realCityEvidence;
  const accessAvailable = !realCity || !!context.realCityEvidence?.serviceCategories.length;

  const sections = [
    { title: "What changed?", value: analysis.mainImpact, icon: Waypoints },
    { title: "Why does it matter?", value: analysis.whyItMatters, icon: ArrowUpRight },
    { title: "Who is most affected?", value: analysis.mostAffectedArea, icon: MapPin },
    {
      title: "The next critical link",
      value: analysis.criticalInfrastructure,
      icon: ArrowDownRight,
    },
  ];
  return (
    <section className="ai-panel" id="ai-brief" aria-label={t("AI Resilience Brief")}>
      <div className="ai-heading">
        <span className="ai-symbol">
          <BrainCircuit size={23} />
        </span>
        <div>
          <span className="eyebrow">{t("FROM SIMULATION TO UNDERSTANDING")}</span>
          <h2>{t("AI Resilience Brief")}</h2>
        </div>
        <div className="ai-source">
          <span className="status-dot" />
          {source === "openai"
            ? t("OpenAI · grounded in model evidence")
            : t("Evidence-based local analysis")}
          <button
            className="icon-button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={t("Refresh resilience brief")}
          >
            {loading ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}
          </button>
        </div>
      </div>
      <p className="ai-summary" data-testid="ai-summary">
        {analysis.summary}
      </p>
      <div className="evidence-strip">
        <span>
          <small>{t("AVG. TRAVEL CHANGE")}</small>
          <strong>{signed(context.travelTimeChangePercent)}%</strong>
        </span>
        <span>
          <small>{t("ACCESS CHANGE")}</small>
          <strong>
            {accessAvailable
              ? `${signed(context.current.accessibility - context.baseline.accessibility)} ${t(" pts")}`
              : t("N/A")}
          </strong>
        </span>
        <span>
          <small>{t("DISCONNECTED DEMAND")}</small>
          <strong>
            {formatNumber(context.current.disconnectedDemand, 0)}{" "}
            <em>{t(realCity ? "modeled units/h" : "trips / h")}</em>
          </strong>
        </span>
        {context.bestRecovery && (
          <span>
            <small>{t("BEST RECOVERY")}</small>
            <strong>
              {signed(context.bestRecovery.resilienceGain)} <em>{t("resilience pts")}</em>
            </strong>
          </span>
        )}
      </div>
      <div className="brief-grid">
        {sections.map(({ title, value, icon: Icon }) => (
          <article key={t(title)}>
            <h3>
              <Icon size={15} />
              {t(title)}
            </h3>
            <p>{value}</p>
          </article>
        ))}
      </div>
      <div className="recommendations">
        <h3>
          <Sparkles size={15} />
          {t("Possible planning actions")}
        </h3>
        <ol>
          {analysis.recommendedActions.map((action, index) => (
            <li key={action}>
              <span>{index + 1}</span>
              {action}
              <ChevronRight size={14} />
            </li>
          ))}
        </ol>
      </div>
      <p className="ai-limitations">
        <Check size={13} />
        <span>
          {analysis.limitations}{" "}
          {source === "local" &&
            t(
              "Local analysis uses deterministic rules; a server-configured LLM can provide the same structured brief.",
            )}
        </span>
      </p>
    </section>
  );
}
