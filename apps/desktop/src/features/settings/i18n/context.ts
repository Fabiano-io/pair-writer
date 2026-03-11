import { createContext } from "react";
import type { Locale, StringKey } from "./strings";

export interface I18nContextValue {
  locale: Locale;
  t: (key: StringKey) => string;
}

export const I18nContext = createContext<I18nContextValue | null>(null);