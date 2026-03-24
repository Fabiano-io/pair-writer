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

const UI_SCALES: { id: AppearanceSettings["uiScale"]; labelKey: "prefs_ui_scale_compact" | "prefs_ui_scale_default" | "prefs_ui_scale_comfortable" }[] = [
  { id: "compact", labelKey: "prefs_ui_scale_compact" },
  { id: "default", labelKey: "prefs_ui_scale_default" },
  { id: "comfortable", labelKey: "prefs_ui_scale_comfortable" },
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
  const [uiScale, setUiScale] = useState(initialAppearance.uiScale);

  const apply = useCallback(
    (next: AppearanceSettings) => {
      saveAppearance(next).then(() => onSaved(next));
    },
    [onSaved]
  );

  const handleThemeSelect = useCallback(
    (id: AppearanceSettings["theme"]) => {
      setTheme(id);
      const next: AppearanceSettings = { theme: id, fontPreset, language, uiScale };
      apply(next);
    },
    [fontPreset, language, uiScale, apply]
  );

  const handleFontPresetSelect = useCallback(
    (id: AppearanceSettings["fontPreset"]) => {
      setFontPreset(id);
      const next: AppearanceSettings = { theme, fontPreset: id, language, uiScale };
      apply(next);
    },
    [theme, language, uiScale, apply]
  );

  const handleLanguageSelect = useCallback(
    (id: AppearanceSettings["language"]) => {
      setLanguage(id);
      const next: AppearanceSettings = { theme, fontPreset, language: id, uiScale };
      apply(next);
    },
    [theme, fontPreset, uiScale, apply]
  );

  const handleUiScaleSelect = useCallback(
    (id: AppearanceSettings["uiScale"]) => {
      setUiScale(id);
      const next: AppearanceSettings = { theme, fontPreset, language, uiScale: id };
      apply(next);
    },
    [theme, fontPreset, language, apply]
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-4"
      onClick={handleClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="max-w-[480px] w-full overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-[0_30px_90px_rgba(0,0,0,0.48)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-[color:var(--app-border)] px-6 py-4 flex items-start justify-between gap-4">
          <h2 id={titleId} className="text-[15px] font-medium tracking-tight text-[var(--app-text)]">
            {t("prefs_title")}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            className="rounded border border-[color:var(--app-border)] px-3 py-1.5 text-xs text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
          >
            {t("prefs_close")}
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 py-5 space-y-6 max-h-[min(90vh,600px)]">
          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
              {t("prefs_theme")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {THEMES.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleThemeSelect(id)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    theme === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] font-medium"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
              {t("prefs_font_preset")}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--app-text-muted)]/75">
              {t("prefs_font_note")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {FONT_PRESETS.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleFontPresetSelect(id)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    fontPreset === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] font-medium"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
              {t("prefs_ui_scale")}
            </p>
            <p className="mt-0.5 text-[11px] leading-4 text-[var(--app-text-muted)]/75">
              {t("prefs_ui_scale_note")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {UI_SCALES.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleUiScaleSelect(id)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    uiScale === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] font-medium"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]">
              {t("prefs_language")}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LANGUAGES.map(({ id, labelKey }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleLanguageSelect(id)}
                  className={`rounded px-3 py-1.5 text-xs transition-colors ${
                    language === id
                      ? "bg-[var(--app-surface-alt)] text-[var(--app-text)] font-medium"
                      : "text-[var(--app-text-muted)] hover:bg-[var(--app-hover-bg)] hover:text-[var(--app-text)]"
                  }`}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
