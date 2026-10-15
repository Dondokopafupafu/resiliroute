"use client";
import Link from "next/link";
import { useLocale } from "./locale-provider";
export function ModeSwitch({ mode }: { mode: "demo" | "real" }) {
  const { t } = useLocale();
  return (
    <div className="mode-switch" role="group" aria-label={t("City mode")}>
      <Link href="/" aria-current={mode === "demo" ? "page" : undefined}>
        {t("Demo City")}
      </Link>
      <Link href="/real-city" aria-current={mode === "real" ? "page" : undefined}>
        {t("Real City Lab")}
      </Link>
    </div>
  );
}
