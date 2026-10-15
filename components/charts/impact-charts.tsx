"use client";

import { useLocale } from "@/components/locale-provider";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";
import type { SimulationResult } from "@/types/network";

const colors = { before: "#b8cbd3", after: "#107d8a" };
const tooltipStyle = {
  border: "1px solid #e0e7eb",
  borderRadius: 10,
  fontSize: 12,
  boxShadow: "0 4px 20px #162c3610",
};
const axis = { fill: "#697b85", fontSize: 11 };

export function ImpactCharts({
  baseline,
  current,
  accessibilityAvailable = true,
}: {
  baseline: SimulationResult;
  current: SimulationResult;
  accessibilityAvailable?: boolean;
}) {
  const { t } = useLocale();

  const data = [
    {
      name: t("Access"),
      Baseline: accessibilityAvailable ? baseline.metrics.accessibility : null,
      Scenario: accessibilityAvailable ? current.metrics.accessibility : null,
    },
    {
      name: t("Efficiency"),
      Baseline: baseline.metrics.networkEfficiency,
      Scenario: current.metrics.networkEfficiency,
    },
    {
      name: t("Resilience"),
      Baseline: baseline.metrics.resilienceScore,
      Scenario: current.metrics.resilienceScore,
    },
  ];
  const districtData = current.districts.map((d) => ({
    name: t(d.district),
    Baseline: baseline.districts.find((b) => b.district === d.district)!.accessibility,
    Scenario: d.accessibility,
  }));
  return (
    <div className="charts-grid">
      <article className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h3>{t("Citywide impact")}</h3>
            <p>{t("Before & after · independent 0–100 indicators")}</p>
          </div>
          <span className="panel-tag">{t("COMPARISON")}</span>
        </div>
        <div
          className="chart"
          role="img"
          aria-label={t(
            "Citywide comparison. Accessibility {accessBefore} to {accessAfter}; efficiency {efficiencyBefore} to {efficiencyAfter}; resilience {resilienceBefore} to {resilienceAfter}.",
            {
              accessBefore: accessibilityAvailable
                ? formatNumber(baseline.metrics.accessibility)
                : t("N/A"),
              accessAfter: accessibilityAvailable
                ? formatNumber(current.metrics.accessibility)
                : t("N/A"),
              efficiencyBefore: formatNumber(baseline.metrics.networkEfficiency),
              efficiencyAfter: formatNumber(current.metrics.networkEfficiency),
              resilienceBefore: formatNumber(baseline.metrics.resilienceScore),
              resilienceAfter: formatNumber(current.metrics.resilienceScore),
            },
          )}
        >
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f3" />
              <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={axis} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "#f2f6f7" }}
                formatter={(value) => `${formatNumber(Number(value))} / 100`}
              />
              <Legend
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
              />
              <Bar
                dataKey="Baseline"
                name={t("Baseline")}
                fill={colors.before}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
                isAnimationActive={false}
              />
              <Bar
                dataKey="Scenario"
                name={t("Scenario")}
                fill={current.closedEdgeIds.length ? "#da704c" : colors.after}
                radius={[4, 4, 0, 0]}
                maxBarSize={34}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>
      <article className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <h3>{t("District accessibility")}</h3>
            <p>{t("Who retains timely access to essential services?")}</p>
          </div>
          <span className="panel-tag">{t("EQUITY")}</span>
        </div>
        {accessibilityAvailable ? (
          <div
            className="chart"
            role="img"
            aria-label={t("District access: {values}.", {
              values: districtData
                .map((d) =>
                  t("{name}, {before} to {after} percent", {
                    name: d.name,
                    before: formatNumber(d.Baseline),
                    after: formatNumber(d.Scenario),
                  }),
                )
                .join("; "),
            })}
          >
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={districtData}
                margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
                barGap={4}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf1f3" />
                <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tick={axis}
                  tickFormatter={(v) => `${v}%`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "#f2f6f7" }}
                  formatter={(value) => `${formatNumber(Number(value))}%`}
                />
                <Legend
                  iconType="circle"
                  iconSize={7}
                  wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
                />
                <Bar
                  dataKey="Baseline"
                  name={t("Baseline")}
                  fill={colors.before}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="Scenario"
                  name={t("Scenario")}
                  fill={colors.after}
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="chart real-access-note" role="status">
            {t("No supported facilities were imported. Accessibility is unavailable.")}
          </p>
        )}
      </article>
    </div>
  );
}
