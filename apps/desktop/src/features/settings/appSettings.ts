import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  AppearanceSettings,
  WorkspaceLayoutSettings,
} from "./settingsDefaults";
import { DEFAULT_APPEARANCE, DEFAULT_SETTINGS } from "./settingsDefaults";

export async function loadSettings(): Promise<AppSettings> {
  try {
    const s = await invoke<AppSettings>("load_settings");
    return {
      ...s,
      appearance: normalizeAppearance(s.appearance),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function normalizeAppearance(a?: AppearanceSettings | null): AppearanceSettings {
  if (!a) return DEFAULT_APPEARANCE;
  const validTheme =
    a.theme === "dark-blue" || a.theme === "dark-graphite" ? a.theme : "dark";
  const validFontPreset =
    a.fontPreset === "reading" || a.fontPreset === "editorial"
      ? a.fontPreset
      : "default";
  const validLanguage = a.language === "pt" ? "pt" : "en";
  return {
    theme: validTheme,
    fontPreset: validFontPreset,
    language: validLanguage,
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await invoke("save_settings", { settings });
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export async function saveWorkspaceLayout(
  layout: WorkspaceLayoutSettings
): Promise<void> {
  const current = await loadSettings();
  await saveSettings({
    ...current,
    workspaceLayout: layout,
  });
}

/** Saves projectRootPath as application convenience (reopen last folder). Not source of truth. */
export async function saveProjectRootPath(
  path: string | null
): Promise<void> {
  const current = await loadSettings();
  await saveSettings({
    ...current,
    projectRootPath: path,
  });
}

/** Saves appearance preferences (theme, font preset, language). */
export async function saveAppearance(
  appearance: AppearanceSettings
): Promise<void> {
  const current = await loadSettings();
  await saveSettings({
    ...current,
    appearance: normalizeAppearance(appearance),
  });
}
