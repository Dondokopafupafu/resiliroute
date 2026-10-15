"use client";
import { useLocale } from "@/components/locale-provider";
import { TriangleAlert } from "lucide-react";
export default function Error({ reset }: { reset: () => void }) {
  const { t } = useLocale();

  return (
    <main className="error-page">
      <TriangleAlert size={32} />
      <h1>{t("The simulation could not load.")}</h1>
      <p>
        {t("Your local scenario can be restarted. No account or saved personal data is involved.")}
      </p>
      <button className="button button-teal" onClick={reset}>
        {t("Restart simulator")}
      </button>
    </main>
  );
}
