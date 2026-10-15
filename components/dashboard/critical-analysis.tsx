"use client";

import { useLocale } from "@/components/locale-provider";
import {
  ArrowRight,
  CheckCheck,
  FlaskConical,
  LoaderCircle,
  RotateCcw,
  Wrench,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { InfoTip } from "@/components/ui";
import { formatNumber, signed } from "@/lib/format";
import type { CriticalLinkResult, EdgeId, RecoveryResult } from "@/types/network";

export function CriticalAnalysis({
  ranking,
  recovery,
  selectedEdgeId,
  onHighlight,
  onSelect,
  onRestore,
  onAnalyze,
  analyzing,
  candidateScreening = false,
  realCity = false,
}: {
  ranking: CriticalLinkResult[];
  recovery: RecoveryResult[];
  selectedEdgeId: EdgeId | null;
  onHighlight: (id: EdgeId | null) => void;
  onSelect: (id: EdgeId) => void;
  onRestore: (id: EdgeId) => void;
  onAnalyze: () => void;
  analyzing: boolean;
  candidateScreening?: boolean;
  realCity?: boolean;
}) {
  const { t } = useLocale();

  return (
    <div className="analysis-grid">
      <article className="panel critical-panel" id="critical-analysis">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{t("SINGLE-LINK STRESS TEST")}</span>
            <h3>{t("Where would the next failure hurt?")}</h3>
            <p>{t("Available links, ranked by additional citywide impact.")}</p>
          </div>
          <InfoTip
            label={t("Criticality")}
            text={t(
              candidateScreening
                ? "Candidate links are removed individually and all network metrics recalculated. Large networks use a screened subset, not an exhaustive ranking. Scores combine modeled travel-time increase, access and efficiency loss, and disconnected demand; they are not failure probabilities."
                : "Each available link is removed individually and all network metrics recalculated. Fixed weights combine travel-time increase, accessibility and efficiency loss, and disconnected demand. Scores are impact indices, not failure probabilities.",
            )}
          />
        </div>
        <div className="ranking-scale">
          <span>{t("CRITICAL LINK")}</span>
          <span>{t("IMPACT INDEX / 100")}</span>
        </div>
        <div className="ranking-list" aria-label={t("Critical links ranking")}>
          {ranking.slice(0, 5).map((link, index) => (
            <button
              key={link.edgeId}
              className={`ranking-row ${selectedEdgeId === link.edgeId ? "active" : ""}`}
              onMouseEnter={() => onHighlight(link.edgeId)}
              onMouseLeave={() => onHighlight(null)}
              onFocus={() => onHighlight(link.edgeId)}
              onBlur={() => onHighlight(null)}
              onClick={() => onSelect(link.edgeId)}
              aria-label={t("Inspect {name}, criticality {score}", {
                name: realCity ? link.name : t(link.name),
                score: formatNumber(link.score),
              })}
            >
              <span className="rank-position">{String(index + 1).padStart(2, "0")}</span>
              <span className="rank-content">
                <span>{realCity ? link.name : t(link.name)}</span>
                <span className="rank-track" aria-hidden="true">
                  <ResponsiveContainer width="100%" height={5} minWidth={0}>
                    <BarChart
                      data={[{ score: link.score }]}
                      layout="vertical"
                      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
                      accessibilityLayer={false}
                    >
                      <XAxis type="number" domain={[0, 100]} hide />
                      <YAxis type="category" hide />
                      <Bar
                        dataKey="score"
                        barSize={5}
                        background={{ fill: "#eff4f5" }}
                        fill={index === 0 ? "#c85c35" : "#4c95a1"}
                        radius={[2, 2, 2, 2]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </span>
              </span>
              <strong>{formatNumber(link.score)}</strong>
              <ArrowRight size={13} />
            </button>
          ))}
        </div>
        {!ranking.length && (
          <p className="empty-disruptions">{t("No available links remain to analyze.")}</p>
        )}
        <div className="ranking-footnote">
          {t("Removing the top link:")}{" "}
          <strong>
            {ranking[0]
              ? `${signed(ranking[0].travelTimeIncrease)} ${t("min")} · ${signed(-ranking[0].accessibilityLoss)} ${t("access pts")}`
              : t("No available links")}
          </strong>
        </div>
        <button
          className="button button-secondary full-width"
          disabled={analyzing || !ranking.length}
          onClick={onAnalyze}
        >
          {analyzing ? <LoaderCircle className="spin" size={15} /> : <FlaskConical size={15} />}{" "}
          {analyzing
            ? t("Analyzing network resilience…")
            : t(candidateScreening ? "Analyze candidate links" : "Analyze all available links")}
        </button>
      </article>
      <article className="panel recovery-panel" id="recovery-analysis">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{t("RECOVERY OPTIMIZER")}</span>
            <h3>{t("What should recover first?")}</h3>
            <p>{t("Reopen one link. Measure the improvement.")}</p>
          </div>
          <Wrench size={18} />
        </div>
        {recovery.length ? (
          <>
            <div className="best-recovery">
              <span>
                <CheckCheck size={14} />
                {t("HIGHEST-IMPACT RECOVERY")}
              </span>
              <h4>{realCity ? recovery[0].name : t(recovery[0].name)}</h4>
              <div>
                <strong>
                  {signed(recovery[0].resilienceGain)}
                  <small>{t("resilience points")}</small>
                </strong>
                <span>
                  {signed(recovery[0].accessibilityGain)} {t(" access pts")}
                  <br />
                  {formatNumber(recovery[0].travelTimeSaved)} {t(" min saved")}
                </span>
              </div>
              <button
                className="button button-teal full-width"
                onClick={() => onRestore(recovery[0].edgeId)}
              >
                <RotateCcw size={14} />
                {t("Restore {name}", { name: realCity ? recovery[0].name : t(recovery[0].name) })}
                <ArrowRight size={14} />
              </button>
            </div>
            <div className="recovery-alternatives">
              {recovery.slice(1).map((link) => (
                <button
                  key={link.edgeId}
                  onClick={() => onRestore(link.edgeId)}
                  onMouseEnter={() => onHighlight(link.edgeId)}
                  onMouseLeave={() => onHighlight(null)}
                >
                  <span>
                    <RotateCcw size={13} />
                    {realCity ? link.name : t(link.name)}
                  </span>
                  <strong>
                    {signed(link.resilienceGain)}
                    <small> {t(" pts")}</small>
                  </strong>
                </button>
              ))}
            </div>
            <p className="recovery-note">
              {t(
                "Each gain is relative to the current scenario. These are independent single-link repairs, not a multi-repair sequence.",
              )}
            </p>
          </>
        ) : (
          <div className="recovery-empty">
            <span className="recovery-icon">
              <Wrench size={24} />
            </span>
            <h4>{t("No repairs needed.")}</h4>
            <p>
              {t(
                realCity
                  ? "Close a real road to compare modeled recovery strategies."
                  : "Close a link or run the earthquake demo to compare modeled recovery strategies.",
              )}
            </p>
          </div>
        )}
      </article>
    </div>
  );
}
