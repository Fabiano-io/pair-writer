import { invoke } from "@tauri-apps/api/core";
import type { AppSettings, WorkspaceLayoutSettings } from "./settingsDefaults";
import { DEFAULT_SETTINGS } from "./settingsDefaults";

export async function loadSettings(): Promise<AppSettings> {
  try {
    return await invoke<AppSettings>("load_settings");
  } catch {
    return DEFAULT_SETTINGS;
  }
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
