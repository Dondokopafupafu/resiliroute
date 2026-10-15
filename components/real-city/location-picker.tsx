"use client";
import { useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { locationBounds } from "@/lib/real-city/location-input";
import type { BoundingBox } from "@/types/real-city";

export function LocationPicker({
  disabled,
  onChoose,
}: {
  disabled: boolean;
  onChoose: (bbox: BoundingBox) => void;
}) {
  const { t } = useLocale();
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  return (
    <form
      className="location-picker"
      onSubmit={(event) => {
        event.preventDefault();
        if (disabled) return;
        try {
          onChoose(locationBounds(value));
          setError(false);
        } catch {
          setError(true);
        }
      }}
    >
      <label className="field-label" htmlFor="custom-location">
        {t("Go to your own location")}
      </label>
      <input
        id="custom-location"
        value={value}
        disabled={disabled}
        maxLength={1000}
        placeholder="35.6812, 139.7671"
        autoComplete="off"
        spellCheck={false}
        aria-describedby="location-help"
        aria-invalid={error || undefined}
        onChange={(event) => {
          setValue(event.target.value);
          setError(false);
        }}
      />
      <p id="location-help" className="table-note">
        {t(
          "Paste latitude, longitude or an OpenStreetMap map URL. A 2 × 2 km selection is created; adjust its corners on the map.",
        )}
      </p>
      <button
        className="button button-secondary"
        disabled={disabled || !value.trim()}
        type="submit"
      >
        {t("Show this location")}
      </button>
      {error && (
        <p role="alert" className="real-error">
          {t(
            "Enter valid latitude, longitude or an OpenStreetMap URL containing #map=zoom/latitude/longitude.",
          )}
        </p>
      )}
    </form>
  );
}
