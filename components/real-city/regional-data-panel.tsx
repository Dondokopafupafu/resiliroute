"use client";
import { useEffect, useRef, useState } from "react";
import { Database, LoaderCircle } from "lucide-react";
import { useLocale } from "@/components/locale-provider";
import type { BoundingBox } from "@/types/real-city";

interface RegionInfo {
  id: string;
  name: string;
  bytes: number;
  cached: boolean;
  available: boolean;
  maxBytes: number;
}
function regionInfo(value: unknown): RegionInfo | null {
  if (!value || typeof value !== "object" || !("region" in value)) return null;
  const info = value.region;
  if (!info || typeof info !== "object") return null;
  const r = info as Partial<RegionInfo>;
  return typeof r.id === "string" &&
    r.id.length < 500 &&
    typeof r.name === "string" &&
    r.name.length < 500 &&
    typeof r.bytes === "number" &&
    Number.isFinite(r.bytes) &&
    r.bytes > 0 &&
    typeof r.cached === "boolean" &&
    typeof r.available === "boolean" &&
    typeof r.maxBytes === "number" &&
    Number.isFinite(r.maxBytes) &&
    r.maxBytes > 0
    ? (r as RegionInfo)
    : null;
}

/** Metadata is checked first. A potentially large download always needs its own visible click. */
export function RegionalDataPanel({
  bbox,
  disabled,
  busy,
  onPrepare,
}: {
  bbox: BoundingBox | null;
  disabled: boolean;
  busy: boolean;
  onPrepare: (regionId: string) => void;
}) {
  const { t } = useLocale();
  const key = bbox ? JSON.stringify(bbox) : "none";
  const [checked, setChecked] = useState<{
    key: string;
    region?: RegionInfo;
    failed?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), [key]);
  const current = checked?.key === key ? checked : null;
  const checking = loading === key;
  const check = async () => {
    if (!bbox || disabled || busy) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(key);
    setChecked(null);
    const timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch("/api/osm/region", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bbox),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Region unavailable");
      const region = regionInfo(await response.json());
      if (!region) throw new Error("Invalid region information");
      if (request.current === controller && !controller.signal.aborted) setChecked({ key, region });
    } catch {
      if (request.current === controller) setChecked({ key, failed: true });
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(null);
    }
  };
  return (
    <section className="regional-data-panel" data-testid="regional-data-panel">
      <h3>
        <Database size={17} />
        {t("Prepare regional data in this app")}
      </h3>
      <p>
        {t(
          "Another way to build your own area: download an OSM regional dataset once, then cut out selected areas locally. No external site or manual file handling.",
        )}
      </p>
      <button
        type="button"
        className="button button-secondary"
        disabled={disabled || busy || checking || !bbox}
        onClick={() => void check()}
      >
        {checking && <LoaderCircle size={15} className="spin" />}
        {t(checking ? "Checking regional data…" : "Check region and download size")}
      </button>
      <small>
        {t("This check only reads source metadata. The download starts after you confirm below.")}
      </small>
      {current?.failed && (
        <p role="alert" className="real-error">
          {t(
            "Regional data information is unavailable. Retry later or use the direct Build button.",
          )}
        </p>
      )}
      {current?.region && (
        <div className="region-download-preview" data-testid="regional-download-preview">
          <strong>{current.region.name}</strong>
          <span>
            {(current.region.bytes / 1_000_000).toFixed(1)} MB ·{" "}
            {t(
              current.region.cached
                ? "Already stored on this app server"
                : "One-time regional download",
            )}
          </span>
          <p>
            {t(
              current.region.cached
                ? "The saved source can be reused for other areas within this region."
                : "The first download may take several minutes and uses server disk space. You can cancel it; later selections reuse the saved source.",
            )}
          </p>
          {!current.region.available && (
            <p role="alert">
              {t(
                "This regional source exceeds the {max} MB download limit. Choose another region or use direct import.",
                { max: Math.round(current.region.maxBytes / 1_000_000) },
              )}
            </p>
          )}
          <button
            type="button"
            className="button button-primary"
            disabled={busy || !current.region.available || disabled}
            onClick={() => onPrepare(current.region!.id)}
          >
            {t(
              current.region.cached
                ? "Build from saved regional data"
                : "Download regional data and build",
            )}
          </button>
          <small>
            {t(
              "Source: OpenStreetMap contributors / Geofabrik. The selected area still uses modeled demand.",
            )}
          </small>
        </div>
      )}
    </section>
  );
}
