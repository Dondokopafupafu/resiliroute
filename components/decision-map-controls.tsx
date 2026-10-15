"use client";

import { useLocale } from "./locale-provider";
import {
  criticalColors,
  cascadeColors,
  bandText,
  type DecisionMapLayer,
  type DecisionMapView,
} from "@/lib/decision/map-style";
import { criticalityBand, explainCriticality } from "@/lib/decision/evidence";
import { formatNumber, signed } from "@/lib/format";
import type { CriticalLinkResult } from "@/types/network";
import "./decision-map.css";

export function DecisionMapControls({
  layer,
  view,
  onLayer,
  onView,
  tested,
  total,
}: {
  layer: DecisionMapLayer;
  view: DecisionMapView;
  onLayer: (value: DecisionMapLayer) => void;
  onView: (value: DecisionMapView) => void;
  tested: number;
  total: number;
}) {
  const { locale } = useLocale();
  const ja = locale === "ja";
  const effective = view === "before" ? "traffic" : layer;
  return (
    <div className="decision-map-controls">
      <div className="decision-map-control-row">
        <label>
          {ja ? "地図の表示" : "Map evidence"}
          <select
            aria-label={ja ? "地図の分析レイヤー" : "Map analysis layer"}
            value={layer}
            onChange={(e) => {
              onLayer(e.target.value as DecisionMapLayer);
              onView("after");
            }}
          >
            <option value="traffic">{ja ? "モデル交通量" : "Modeled traffic"}</option>
            <option value="criticality">{ja ? "重要度ヒートマップ" : "Criticality heatmap"}</option>
            <option value="cascade">{ja ? "波及する負荷" : "Cascading stress"}</option>
          </select>
        </label>
        <div
          className="decision-map-toggle"
          role="group"
          aria-label={ja ? "地図のみの前後比較" : "Map-only before and after"}
        >
          <button type="button" aria-pressed={view === "before"} onClick={() => onView("before")}>
            {ja ? "通常時" : "Before"}
          </button>
          <button type="button" aria-pressed={view === "after"} onClick={() => onView("after")}>
            {ja ? "現在" : "After"}
          </button>
        </div>
      </div>
      {view === "before" && (
        <p>
          {ja
            ? "地図は通常時。下の分析結果は現在のシナリオです。"
            : "Map shows the baseline. Analysis below remains the current scenario."}
        </p>
      )}
      {effective !== "traffic" && (
        <div className="decision-map-key" data-testid="decision-map-legend">
          {Object.entries(effective === "criticality" ? criticalColors : cascadeColors).map(
            ([band, color]) => (
              <span key={band}>
                <i style={{ background: color }} />
                {bandText(band, locale)}
              </span>
            ),
          )}
          <span>
            <i className="decision-closed-key" />
            {ja ? "閉鎖" : "Closed"}
          </span>
          <p>
            {effective === "criticality"
              ? ja
                ? `${total} 本中 ${tested} 本を解析。解析済みリンクの最大重要度に対する5段階表示。`
                : `${tested} of ${total} links tested. Five bands relative to the highest tested criticality.`
              : ja
                ? "通常時からの使用率増分（ポイント）：10未満／10–30／30–60／60以上。物理的損傷の予測ではありません。"
                : "Utilization increase from baseline (points): <10 / 10–30 / 30–60 / ≥60. This is load redistribution, not predicted damage."}
          </p>
        </div>
      )}
    </div>
  );
}

export function CriticalityDetail({
  selected,
  critical,
}: {
  selected: string | null;
  critical: readonly CriticalLinkResult[];
}) {
  const { locale, t } = useLocale();
  const item = critical.find((entry) => entry.edgeId === selected);
  if (!selected) return null;
  const ja = locale === "ja";
  if (!item)
    return (
      <p className="decision-critical-empty">
        {ja
          ? "このリンクは現在の単独閉鎖解析の対象外です（未解析または閉鎖中）。"
          : "This link is outside the current single-link stress test (untested or already closed)."}
      </p>
    );
  const band = criticalityBand(item.score, Math.max(0, ...critical.map((entry) => entry.score)));
  return (
    <details className="map-critical-detail" data-testid="map-critical-detail">
      <summary>
        {ja ? "選択リンクの重要度" : "Selected link criticality"} · {formatNumber(item.score)} ·{" "}
        {bandText(band, locale)}
      </summary>
      <strong>{t(item.name)}</strong>
      <p>{explainCriticality(item, locale)}</p>
      <dl>
        {[
          [ja ? "移動時間" : "Travel time", `${signed(item.travelTimeIncrease)} min`],
          [
            ja ? "アクセス損失" : "Accessibility loss",
            `${formatNumber(item.accessibilityLoss)} pt`,
          ],
          [ja ? "効率損失" : "Efficiency loss", `${formatNumber(item.efficiencyLoss)} pt`],
          [
            ja ? "到達不能需要の増加" : "Extra disconnected demand",
            formatNumber(item.disconnectedDemandIncrease, 0),
          ],
        ].map(([name, value]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <small>
        {ja
          ? "現在のシナリオから、さらにこのリンクを閉鎖した場合の変化です。"
          : "Changes if this additional link closes, compared with the current scenario."}
      </small>
    </details>
  );
}
