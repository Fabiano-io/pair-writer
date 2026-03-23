import { invoke } from "@tauri-apps/api/core";
import type {
  AppSettings,
  AppearanceSettings,
  ChatModelCatalogEntry,
  ChatProvider,
  ChatGeneralSettings,
  ChatSettings,
  WorkspaceLayoutSettings,
} from "./settingsDefaults";
import {
  DEFAULT_APPEARANCE,
  DEFAULT_CHAT_GENERAL_SETTINGS,
  DEFAULT_CHAT_MODEL_CATALOG,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_SETTINGS,
} from "./settingsDefaults";
import {
  resolveDefaultBubbleModelId,
  resolveDefaultChatModelId,
} from "../chat/chatModelDefaults";

export async function loadSettings(): Promise<AppSettings> {
  try {
    const s = await invoke<AppSettings>("load_settings");
    return normalizeSettings(s);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function normalizeSettings(s?: Partial<AppSettings> | null): AppSettings {
  const settings = s ?? {};

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    window: {
      ...DEFAULT_SETTINGS.window,
      ...settings.window,
    },
    workspaceLayout: {
      ...DEFAULT_SETTINGS.workspaceLayout,
      ...settings.workspaceLayout,
    },
    projectRootPath: settings.projectRootPath ?? null,
    appearance: normalizeAppearance(settings.appearance),
    chat: normalizeChatSettings(settings.chat),
  };
}

function normalizeAppearance(a?: AppearanceSettings | null): AppearanceSettings {
  if (!a) return DEFAULT_APPEARANCE;
  const validTheme =
    a.theme === "dark" ||
    a.theme === "light" ||
    a.theme === "dark-blue" ||
    a.theme === "dark-graphite"
      ? a.theme
      : "dark";
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

function normalizeChatSettings(
  chat?: ChatSettings | null
): ChatSettings {
  if (!chat) {
    return cloneChatSettings(DEFAULT_CHAT_SETTINGS);
  }

  const provider: ChatProvider =
    chat.provider === "openai" ||
    chat.provider === "anthropic" ||
    chat.provider === "gemini" ||
    chat.provider === "lmStudio" ||
    chat.provider === "openAiCompatible"
      ? chat.provider
      : DEFAULT_CHAT_SETTINGS.provider;

  const normalizedChat: ChatSettings = {
    provider,
    general: normalizeChatGeneral(chat.general),
    models: normalizeChatModelCatalog(chat),
    defaultChatModelId:
      chat.defaultChatModelId?.trim() || DEFAULT_CHAT_SETTINGS.defaultChatModelId,
    defaultBubbleModelId:
      chat.defaultBubbleModelId?.trim() || DEFAULT_CHAT_SETTINGS.defaultBubbleModelId,
    openai: {
      model: chat.openai?.model?.trim() || DEFAULT_CHAT_SETTINGS.openai.model,
    },
    anthropic: {
      model:
        chat.anthropic?.model?.trim() ||
        DEFAULT_CHAT_SETTINGS.anthropic.model,
    },
    gemini: {
      model: chat.gemini?.model?.trim() || DEFAULT_CHAT_SETTINGS.gemini.model,
    },
    lmStudio: {
      endpointUrl:
        chat.lmStudio?.endpointUrl?.trim() ||
        DEFAULT_CHAT_SETTINGS.lmStudio.endpointUrl,
      model:
        chat.lmStudio?.model?.trim() || DEFAULT_CHAT_SETTINGS.lmStudio.model,
    },
    openAiCompatible: {
      displayName:
        chat.openAiCompatible?.displayName?.trim() ||
        DEFAULT_CHAT_SETTINGS.openAiCompatible.displayName,
      endpointUrl:
        chat.openAiCompatible?.endpointUrl?.trim() ||
        DEFAULT_CHAT_SETTINGS.openAiCompatible.endpointUrl,
      model:
        chat.openAiCompatible?.model?.trim() ||
        DEFAULT_CHAT_SETTINGS.openAiCompatible.model,
    },
  };

  return applyPrimaryModelSelections(normalizedChat);
}

function normalizeChatGeneral(
  general?: ChatGeneralSettings | null
): ChatGeneralSettings {
  return {
    saveHistory:
      typeof general?.saveHistory === "boolean"
        ? general.saveHistory
        : DEFAULT_CHAT_GENERAL_SETTINGS.saveHistory,
    streamResponses:
      typeof general?.streamResponses === "boolean"
        ? general.streamResponses
        : DEFAULT_CHAT_GENERAL_SETTINGS.streamResponses,
    checkForUpdates:
      typeof general?.checkForUpdates === "boolean"
        ? general.checkForUpdates
        : DEFAULT_CHAT_GENERAL_SETTINGS.checkForUpdates,
  };
}

function normalizeChatModelCatalog(
  chat: ChatSettings
): ChatModelCatalogEntry[] {
  const normalizedStored =
    chat.models
      ?.map((entry) => normalizeChatModelEntry(entry))
      .filter((entry): entry is ChatModelCatalogEntry => entry !== null) ?? [];

  if (normalizedStored.length > 0) {
    return normalizedStored;
  }

  return [
    {
      ...DEFAULT_CHAT_MODEL_CATALOG[0],
      modelId: chat.anthropic?.model?.trim() || DEFAULT_CHAT_SETTINGS.anthropic.model,
    },
    {
      ...DEFAULT_CHAT_MODEL_CATALOG[1],
      modelId: chat.openai?.model?.trim() || DEFAULT_CHAT_SETTINGS.openai.model,
    },
    {
      ...DEFAULT_CHAT_MODEL_CATALOG[2],
      modelId: chat.gemini?.model?.trim() || DEFAULT_CHAT_SETTINGS.gemini.model,
    },
    {
      ...DEFAULT_CHAT_MODEL_CATALOG[3],
      modelId: chat.lmStudio?.model?.trim() || DEFAULT_CHAT_SETTINGS.lmStudio.model,
    },
    {
      ...DEFAULT_CHAT_MODEL_CATALOG[4],
      name:
        chat.openAiCompatible?.displayName?.trim() ||
        DEFAULT_CHAT_MODEL_CATALOG[4].name,
      modelId:
        chat.openAiCompatible?.model?.trim() ||
        DEFAULT_CHAT_SETTINGS.openAiCompatible.model,
    },
  ];
}

function normalizeChatModelEntry(
  entry: ChatModelCatalogEntry | null | undefined
): ChatModelCatalogEntry | null {
  if (!entry) return null;

  const provider: ChatProvider =
    entry.provider === "openai" ||
    entry.provider === "anthropic" ||
    entry.provider === "gemini" ||
    entry.provider === "lmStudio" ||
    entry.provider === "openAiCompatible"
      ? entry.provider
      : DEFAULT_CHAT_SETTINGS.provider;

  const id = entry.id?.trim();
  const name = entry.name?.trim();
  const modelId = entry.modelId?.trim();

  if (!id || !name || !modelId) {
    return null;
  }

  return {
    id,
    name,
    provider,
    modelId,
    enabled: entry.enabled !== false,
    supportsVision: entry.supportsVision === true,
    supportsTools: entry.supportsTools === true,
    supportsThinking: entry.supportsThinking === true,
  };
}

function applyPrimaryModelSelections(chat: ChatSettings): ChatSettings {
  const defaultChatModelId = resolveDefaultChatModelId(
    chat.models,
    chat.provider,
    chat.defaultChatModelId
  );
  const defaultBubbleModelId = resolveDefaultBubbleModelId(
    chat.models,
    chat.provider,
    defaultChatModelId,
    chat.defaultBubbleModelId
  );

  return {
    ...chat,
    models: chat.models.map((entry) => ({ ...entry })),
    defaultChatModelId: defaultChatModelId ?? "",
    defaultBubbleModelId: defaultBubbleModelId ?? "",
    openai: {
      model: resolvePrimaryModelId(chat.models, "openai", chat.openai.model),
    },
    anthropic: {
      model: resolvePrimaryModelId(chat.models, "anthropic", chat.anthropic.model),
    },
    gemini: {
      model: resolvePrimaryModelId(chat.models, "gemini", chat.gemini.model),
    },
    lmStudio: {
      ...chat.lmStudio,
      model: resolvePrimaryModelId(chat.models, "lmStudio", chat.lmStudio.model),
    },
    openAiCompatible: {
      ...chat.openAiCompatible,
      model: resolvePrimaryModelId(
        chat.models,
        "openAiCompatible",
        chat.openAiCompatible.model
      ),
    },
  };
}

function resolvePrimaryModelId(
  models: ChatModelCatalogEntry[],
  provider: ChatProvider,
  fallback: string
): string {
  const enabledMatch = models.find(
    (entry) => entry.provider === provider && entry.enabled
  );

  if (enabledMatch) {
    return enabledMatch.modelId;
  }

  const fallbackMatch = models.find((entry) => entry.provider === provider);
  return fallbackMatch?.modelId || fallback;
}

function cloneChatSettings(chat: ChatSettings): ChatSettings {
  return {
    ...chat,
    general: { ...chat.general },
    models: chat.models.map((entry) => ({ ...entry })),
    openai: { ...chat.openai },
    anthropic: { ...chat.anthropic },
    gemini: { ...chat.gemini },
    lmStudio: { ...chat.lmStudio },
    openAiCompatible: { ...chat.openAiCompatible },
  };
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await invoke("save_settings", { settings: normalizeSettings(settings) });
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

export async function loadAppDataDirectory(): Promise<string> {
  return invoke<string>("get_app_data_directory");
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
