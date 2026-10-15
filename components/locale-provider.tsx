"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";
import { isLocale, translate, type Locale } from "@/lib/i18n/messages";
import type { ReactNode } from "react";

export const LANGUAGE_STORAGE_KEY = "resiliroute-language";
const eventName = "resiliroute-language-change";
let sessionLocale: Locale = "en";
let storageUnavailable = false;
const serverSnapshot = () => "en" as const;
function snapshot(): Locale {
  if (storageUnavailable) return sessionLocale;
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLocale(saved) ? saved : sessionLocale;
  } catch {
    return sessionLocale;
  }
}
function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(eventName, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(eventName, notify);
  };
}
const defaultValue = {
  locale: "en" as Locale,
  setLocale: (locale: Locale) => {
    void locale;
  },
  t: (message: string, values?: Readonly<Record<string, string | number>>) =>
    translate("en", message, values),
};
const LocaleContext = createContext(defaultValue);

export function LocaleProvider({ children }: { children: ReactNode }) {
  // The server always renders English. React reads the saved choice after
  // hydration, avoiding a server/client mismatch or a scenario reset.
  const locale = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const setLocale = useCallback((next: Locale) => {
    sessionLocale = next;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      storageUnavailable = true;
    }
    window.dispatchEvent(new Event(eventName));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (message: string, values?: Readonly<Record<string, string | number>>) =>
        translate(locale, message, values),
    }),
    [locale, setLocale],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function LanguageSwitch() {
  const { locale, setLocale } = useLocale();
  return (
    <div
      className="language-switch"
      role="group"
      aria-label={locale === "ja" ? "表示言語" : "Display language"}
    >
      <button
        type="button"
        lang="ja"
        aria-pressed={locale === "ja"}
        onClick={() => setLocale("ja")}
      >
        日本語
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={locale === "en"}
        onClick={() => setLocale("en")}
      >
        English
      </button>
    </div>
  );
}
