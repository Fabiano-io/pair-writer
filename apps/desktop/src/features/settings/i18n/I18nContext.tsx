import { useCallback, type ReactNode } from "react";
import { I18nContext } from "./context";
import type { Locale, StringKey } from "./strings";
import { strings } from "./strings";

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