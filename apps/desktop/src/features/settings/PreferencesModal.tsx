/**
 * Preferences modal — application appearance and language.
 * Access: View → Preferences… (provisional practical decision for this cycle, not definitive convention).
 */
import { useCallback, useId, useRef, useState } from "react";
import type { AppearanceSettings } from "./settingsDefaults";
import { saveAppearance } from "./appSettings";
import { useTranslation } from "./i18n/useTranslation";
import { useDialogA11y } from "../../components/useDialogA11y";

interface PreferencesModalProps {
  initialAppearance: AppearanceSettings;
  onClose: () => void;
  onSaved: (appearance: AppearanceSettings) => void;
}

const THEMES: { id: AppearanceSettings["theme"]; labelKey: "prefs_theme_dark" | "prefs_theme_light" | "prefs_theme_dark_blue" | "prefs_theme_dark_graphite" }[] = [
  { id: "dark", labelKey: "prefs_theme_dark" },
  { id: "light", labelKey: "prefs_theme_light" },
  { id: "dark-blue", labelKey: "prefs_theme_dark_blue" },
  { id: "dark-graphite", labelKey: "prefs_theme_dark_graphite" },
];

const FONT_PRESETS: { id: AppearanceSettings["fontPreset"]; labelKey: "prefs_font_default" | "prefs_font_reading" | "prefs_font_editorial" }[] = [
  { id: "default", labelKey: "prefs_font_default" },
  { id: "reading", labelKey: "prefs_font_reading" },
  { id: "editorial", labelKey: "prefs_font_editorial" },
];

const LANGUAGES: { id: AppearanceSettings["language"]; labelKey: "prefs_language_en" | "prefs_language_pt" }[] = [
  { id: "en", labelKey: "prefs_language_en" },
  { id: "pt", labelKey: "prefs_language_pt" },
];

export function PreferencesModal({
  initialAppearance,
  onClose,
  onSaved,
}: PreferencesModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [theme, setTheme] = useState(initialAppearance.theme);
  const [fontPreset, setFontPreset] = useState(initialAppearance.fontPreset);
  const [language, setLanguage] = useState(initialAppearance.language);

  const apply = useCallback(
    (next: AppearanceSettings) => {
      saveAppearance(next).then(() => onSaved(next));
    },
    [onSaved]
  );

  const handleThemeSelect = useCallback(
    (id: AppearanceSettings["theme"]) => {
      setTheme(id);
      const next: AppearanceSettings = { theme: id, fontPreset, language };
      apply(next);
    },
    [fontPreset, language, apply]
  );

  const handleFontPresetSelect = useCallback(
    (id: AppearanceSettings["fontPreset"]) => {
      setFontPreset(id);
      const next: AppearanceSettings = { theme, fontPreset: id, language };
      apply(next);
    },
    [theme, language, apply]
  );

  const handleLanguageSelect = useCallback(
    (id: AppearanceSettings["language"]) => {
      setLanguage(id);
      const next: AppearanceSettings = { theme, fontPreset, language: id };
      apply(next);
    },
    [theme, fontPreset, apply]
  );

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);
  const dialogRef = useDialogA11y({
    isOpen: true,
    onClose: handleClose,
    initialFocusRef: closeButtonRef,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-96 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-sm font-semibold text-[var(--app-text)]">
          {t("prefs_title")}
        </h2>

        <div className="mt-5 space-y-5">
          <section>
            <label className="block text-xs font-medium text-[var(--app-text-muted)]">
              {t("prefs_theme")}
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {THEMES.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleThemeSelect(id)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    theme === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)]"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="block text-xs font-medium text-[var(--app-text-muted)]">
              {t("prefs_font_preset")}
            </label>
            <p className="mt-0.5 text-[10px] text-[var(--app-text-muted)]/80">
              {t("prefs_font_note")}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {FONT_PRESETS.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleFontPresetSelect(id)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    fontPreset === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)]"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <label className="block text-xs font-medium text-[var(--app-text-muted)]">
              {t("prefs_language")}
            </label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {LANGUAGES.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleLanguageSelect(id)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    language === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)]"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>
        </div>

        <button
          ref={closeButtonRef}
          type="button"
          onClick={handleClose}
          className="mt-6 w-full rounded bg-[var(--app-surface-alt)] px-3 py-1.5 text-xs text-[var(--app-text)] transition-colors hover:opacity-90"
        >
          {t("prefs_close")}
        </button>
      </div>
    </div>
  );
}
