"use client";

import { useLocale } from "@/components/locale-provider";
import { useEffect, useRef } from "react";
import { Info, X, Route, ShieldCheck, GitBranch } from "lucide-react";
import type { ReactNode } from "react";
import { DecisionMethodology } from "./decision-methodology";

export function Logo({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();

  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" fill="none">
          <path
            d="M16 2.5 28 7v9c0 6-6 10-12 13-6-3-12-7-12-13V7l12-4.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path d="M10 21V11h12v10H10Zm0 0 12-10" stroke="currentColor" strokeWidth="1.7" />
          <circle cx="10" cy="11" r="2.2" fill="currentColor" />
          <circle cx="22" cy="11" r="2.2" fill="currentColor" />
          <circle cx="10" cy="21" r="2.2" fill="currentColor" />
          <circle cx="22" cy="21" r="2.2" fill="currentColor" />
        </svg>
      </span>
      <span className="brand-type">
        Resili<span>Route</span>
        {!compact && <small>{t("Urban Mobility Resilience Simulator")}</small>}
      </span>
    </span>
  );
}

export function InfoTip({ label, text }: { label: string; text: string }) {
  const { t } = useLocale();

  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-trigger"
        aria-label={t("About {label}", { label: t(label) })}
      >
        <Info size={13} />
      </button>
      <span role="tooltip">{t(text)}</span>
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { t } = useLocale();

  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const active = document.activeElement as HTMLElement | null;
    element?.showModal();
    return () => {
      element?.close();
      active?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="modal"
      aria-label={title}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label={t("Close dialog")}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Methodology() {
  const { t, locale } = useLocale();

  return (
    <div className="methodology">
      <p className="modal-lead">
        {t("Every number starts with a network. Every conclusion points back to evidence.")}
      </p>
      <div className="architecture-strip">
        <span>
          <GitBranch size={18} />
          {t("Graph")}
        </span>
        <b>→</b>
        <span>
          <Route size={18} />
          {t("Routing & demand")}
        </span>
        <b>→</b>
        <span>
          <ShieldCheck size={18} />
          {t("Metrics & stress tests")}
        </span>
        <b>→</b>
        <span>{t("Planning brief")}</span>
      </div>
      <article>
        <h3>{t("01 · Network model")}</h3>
        <p>
          {t(
            "Harbor City is a synthetic 24-node, 42-link network across five districts, with road, bus, rail and pedestrian links. Coordinates are schematic; OpenStreetMap provides geographic context, not validated infrastructure. The 31,100 population weight and 15,615 person-trips per model hour are synthetic. Each link has a shared, two-direction capacity in person-trips per model hour.",
          )}
        </p>
      </article>
      <article>
        <h3>{t("02 · Routing & traffic assignment")}</h3>
        <p>
          {t(
            "A deterministic Dijkstra algorithm minimizes nonnegative travel time. Closed links are removed from the graph. Each OD pair uses its own demand, generated from residential population and destination attraction. A method of successive averages runs 24 assignments: route flows are averaged and congestion costs updated each iteration. Final route exploration uses the final costs. This fixed-iteration approximation is not a proven traffic equilibrium; assigned demand can be split across paths explored during the iterations.",
          )}
        </p>
      </article>
      <article>
        <h3>{t("03 · Congestion")}</h3>
        <code>t = t₀ × [1 + 0.15 × min(v/c, 2.5)⁴]</code>
        <p>
          {t(
            "v is assigned person-trips; c is synthetic capacity. Utilization is not capped; only the BPR time function is capped for numerical stability. “Congestion” is extra assigned person-minutes above free-flow time, divided by assigned free-flow person-minutes. The before/after change is in percentage points. The same educational approximation applies to all modes; rail crowding and transfers are not explicitly modeled.",
          )}
        </p>
      </article>
      <article>
        <h3>{t("04 · Travel time & accessibility")}</h3>
        <p>
          {t(
            "Average travel time is demand-weighted across assigned route flows. Unreachable demand remains in the average with a transparent 60-minute penalty. Accessibility weights each residential population by three equally weighted service categories: at least one hospital within 20 minutes, shelter within 15 minutes, and station within 12 minutes. A facility’s reachable-population measure checks that specific facility, so it differs from the category-based citywide score.",
          )}
        </p>
        <code>
          A = 100 × Σ populationᵢ × (hospitalᵢ + shelterᵢ + stationᵢ) / (3 × Σ populationᵢ)
        </code>
      </article>
      <article>
        <h3>{t("05 · Network efficiency")}</h3>
        <code>E = 100 × Σ demandᵢ × [10 / (10 + shortest_timeᵢ)] / Σ demandᵢ</code>
        <p>
          {t(
            "This bounded, demand-weighted harmonic index uses the final shortest-path costs. Unreachable pairs contribute zero. The 10-minute reference is a stated modeling choice. Efficiency and assignment-weighted average travel time measure different aspects of performance; 100 efficiency would require every OD trip to take zero time.",
          )}
        </p>
      </article>
      <article>
        <h3>{t("06 · Critical-link stress test")}</h3>
        <p>
          {t(
            "Remove each currently available link individually and rerun the entire model. Compare the result with the current scenario. The ranking therefore changes after a disruption. Fixed normalization anchors prevent relative ranking from exaggerating tiny changes.",
          )}
        </p>
        <code>
          C = 100 × (0.35 × ΔT/T + 0.35 × ΔA/A + 0.20 × ΔE/E + 0.10 ×
          Δdisconnected_demand/total_demand)
        </code>
        <p>
          {t(
            "Each term is clamped to [0, 1]; adverse changes count positively and improvements count as zero. Scores are impact indices, not failure probabilities. Zero denominators use 1 as a guard.",
          )}
        </p>
      </article>
      <article>
        <h3>{t("07 · Resilience & district impact")}</h3>
        <code>R = 100 × (0.35 × a² + 0.25 × e² + 0.25 × t² × d² + 0.15 × d²)</code>
        <p>
          {t(
            "a = accessibility retention, e = efficiency retention, t = baseline/current travel time, and d = connected-demand retention. Ratios are clamped to [0, 1]. Squared retention penalizes simultaneous deterioration. These are transparent educational weights, not a validated resilience standard. The baseline is 100 by definition. Bands: 80–100 Resilient; 60–79 Strained; 40–59 Vulnerable; below 40 Critical.",
          )}
        </p>
        <p>
          {t(
            "The most affected district maximizes travel-time increase (%) + accessibility loss (points) + disconnected-demand share (%), with negative changes ignored. Isolation risk is the share of that district’s demand without a reachable destination.",
          )}
        </p>
      </article>
      <article>
        <h3>{t("08 · Recovery & AI pipeline")}</h3>
        <p>
          {t(
            "Reopen each closed link individually and rerun the model against the same normal baseline. Rank by resilience improvement. These are independent marginal recoveries; multiple repairs are not an optimized sequence.",
          )}
        </p>
        <p>
          {t(
            "The local analyst derives structured conclusions from simulation evidence. With a server-only OpenAI key, the Responses API returns a schema-validated brief from the same JSON. The server recomputes all metrics from valid link IDs. LLM prose cannot include numeric claims; exact evidence stays in calculated UI cards. Invalid output, service failure, timeout, or no key automatically uses the local analyst. Local analysis is deterministic, not a language model.",
          )}
        </p>
      </article>
      <DecisionMethodology />
      <article className="limitations-box">
        <h3>{t("Limitations & responsible use")}</h3>
        <p>
          {locale === "ja"
            ? "合成需要と簡略化した静的な混雑モデルを使います。リアルタイム情報、物理的損傷確率、信号制御、交通手段選択、乗換抵抗、車両換算、時間変動する待ち行列は扱いません。不確実性分析はユーザーの仮定に依存します。教育・分析用の意思決定支援プロトタイプであり、避難誘導や公式の安全システムではありません。実際の緊急時は公式情報・自治体の案内に従ってください。"
            : "Synthetic demand and simplified static congestion. No real-time inputs, physical damage probabilities, signal timing, explicit mode choice, transfer penalties, vehicle conversion or time-varying queues. Uncertainty experiments depend on user assumptions. This is an educational decision-support prototype, not an emergency navigation or official safety system. During an emergency, follow official local guidance."}
        </p>
      </article>
    </div>
  );
}

export function About() {
  const { t } = useLocale();

  return (
    <div className="about-content">
      <p className="modal-lead">{t("Understand the ripple effect before a link fails.")}</p>
      <article>
        <span className="eyebrow">{t("THE PROBLEM")}</span>
        <h3>{t("Transportation failures cascade.")}</h3>
        <p>
          {t(
            "A bridge closure can overload another corridor and make a hospital harder to reach on the other side of the city.",
          )}
        </p>
      </article>
      <article>
        <span className="eyebrow">{t("THE INSIGHT")}</span>
        <h3>{t("A connected city can still lose access.")}</h3>
        <p>
          {t(
            "Finding an alternative route is only the start. The time and capacity of that route matter—and different communities feel the impact differently.",
          )}
        </p>
      </article>
      <article>
        <span className="eyebrow">{t("THE SOLUTION")}</span>
        <h3>{t("Make network resilience visible.")}</h3>
        <p>
          {t(
            "ResiliRoute lets communities stress-test a mobility network, trace cascading impacts, identify critical infrastructure and compare possible recoveries.",
          )}
        </p>
      </article>
      <article>
        <span className="eyebrow">{t("THE VISION")}</span>
        <h3>{t("Better questions. More informed communities.")}</h3>
        <p>
          {t(
            "Built for planners, students and local communities to explore transportation resilience before disruption happens. Created as a solo student project for ImpactHack 2026, with AI assistance in design, code, debugging and documentation.",
          )}
        </p>
      </article>
      <p className="notice-text">
        {t(
          "Educational decision-support prototype. All mobility data is synthetic. Follow official local guidance in an actual emergency.",
        )}
      </p>
    </div>
  );
}
