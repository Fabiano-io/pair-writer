import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import type { Locale, StringKey } from "./strings";
import { strings } from "./strings";

interface I18nContextValue {
  locale: Locale;
  t: (key: StringKey) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const t = useCallback(
    (key: StringKey) => strings[locale][key] ?? key,
    [locale]
  );
  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en" as Locale,
      t: (key: StringKey) => key,
    };
  }
  return ctx;
}
