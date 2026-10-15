"use client";
import { useLocale } from "@/components/locale-provider";
import Link from "next/link";
export default function NotFound() {
  const { t } = useLocale();

  return (
    <main className="error-page">
      <h1>{t("This route is outside the network.")}</h1>
      <p>{t("Return to Harbor City to explore the simulator.")}</p>
      <Link href="/" className="button button-teal">
        {t("Open ResiliRoute")}
      </Link>
    </main>
  );
}
