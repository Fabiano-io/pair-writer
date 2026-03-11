import { useContext } from "react";
import { I18nContext } from "./context";
import type { Locale, StringKey } from "./strings";

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