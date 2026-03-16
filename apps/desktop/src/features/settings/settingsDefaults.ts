export interface WindowSettings {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  isMaximized: boolean;
}

export interface WorkspaceLayoutSettings {
  explorerWidth: number;
  chatWidth: number;
}

export interface AppearanceSettings {
  theme: "dark" | "light" | "dark-blue" | "dark-graphite";
  fontPreset: "default" | "reading" | "editorial";
  language: "en" | "pt";
}

export type ChatProvider =
  | "openai"
  | "anthropic"
  | "gemini"
  | "lmStudio"
  | "openAiCompatible";

export interface ProviderModelSettings {
  model: string;
}

export interface ChatModelCatalogEntry {
  id: string;
  name: string;
  provider: ChatProvider;
  modelId: string;
  enabled: boolean;
  supportsVision?: boolean;
  supportsTools?: boolean;
  supportsThinking?: boolean;
}

export interface ChatGeneralSettings {
  saveHistory: boolean;
  streamResponses: boolean;
  checkForUpdates: boolean;
}

export interface LmStudioSettings extends ProviderModelSettings {
  endpointUrl: string;
}

export interface OpenAiCompatibleSettings extends ProviderModelSettings {
  displayName: string;
  endpointUrl: string;
}

export interface ChatSettings {
  provider: ChatProvider;
  general: ChatGeneralSettings;
  models: ChatModelCatalogEntry[];
  openai: ProviderModelSettings;
  anthropic: ProviderModelSettings;
  gemini: ProviderModelSettings;
  lmStudio: LmStudioSettings;
  openAiCompatible: OpenAiCompatibleSettings;
}

export interface AppSettings {
  version: number;
  window: WindowSettings;
  workspaceLayout: WorkspaceLayoutSettings;
  /** Convenience only (e.g. reopen last folder). Not source of truth for project. User selection defines the project. */
  projectRootPath: string | null;
  appearance?: AppearanceSettings;
  chat?: ChatSettings;
}

export const EXPLORER_MIN_WIDTH = 180;
export const EXPLORER_MAX_WIDTH = 420;
export const EXPLORER_DEFAULT_WIDTH = 260;

export const CHAT_MIN_WIDTH = 300;
export const CHAT_MAX_WIDTH = 520;
export const CHAT_DEFAULT_WIDTH = 380;

export const MIN_DOCUMENT_WIDTH = 300;

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  fontPreset: "default",
  language: "en",
};

export const DEFAULT_CHAT_GENERAL_SETTINGS: ChatGeneralSettings = {
  saveHistory: true,
  streamResponses: true,
  checkForUpdates: false,
};

export const DEFAULT_CHAT_MODEL_CATALOG: ChatModelCatalogEntry[] = [
  {
    id: "anthropic-sonnet",
    name: "Claude Sonnet",
    provider: "anthropic",
    modelId: "claude-sonnet-4-5",
    enabled: true,
    supportsVision: false,
    supportsTools: false,
    supportsThinking: false,
  },
  {
    id: "openai-gpt41",
    name: "GPT-4.1",
    provider: "openai",
    modelId: "gpt-4.1",
    enabled: true,
    supportsVision: false,
    supportsTools: false,
    supportsThinking: false,
  },
  {
    id: "gemini-pro",
    name: "Gemini 2.5 Pro",
    provider: "gemini",
    modelId: "gemini-2.5-pro",
    enabled: true,
    supportsVision: false,
    supportsTools: false,
    supportsThinking: false,
  },
  {
    id: "lmstudio-local",
    name: "LM Studio Local",
    provider: "lmStudio",
    modelId: "local-model",
    enabled: true,
    supportsVision: false,
    supportsTools: false,
    supportsThinking: false,
  },
  {
    id: "openai-compatible-custom",
    name: "Custom Endpoint",
    provider: "openAiCompatible",
    modelId: "custom-model",
    enabled: true,
    supportsVision: false,
    supportsTools: false,
    supportsThinking: false,
  },
];

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  provider: "lmStudio",
  general: DEFAULT_CHAT_GENERAL_SETTINGS,
  models: DEFAULT_CHAT_MODEL_CATALOG,
  openai: {
    model: "gpt-4.1",
  },
  anthropic: {
    model: "claude-sonnet-4-5",
  },
  gemini: {
    model: "gemini-2.5-pro",
  },
  lmStudio: {
    endpointUrl: "http://127.0.0.1:1234",
    model: "local-model",
  },
  openAiCompatible: {
    displayName: "OpenAI-Compatible",
    endpointUrl: "http://127.0.0.1:1234",
    model: "custom-model",
  },
};

export const DEFAULT_SETTINGS: AppSettings = {
  version: 4,
  window: {
    width: 1280,
    height: 800,
    x: null,
    y: null,
    isMaximized: false,
  },
  workspaceLayout: {
    explorerWidth: EXPLORER_DEFAULT_WIDTH,
    chatWidth: CHAT_DEFAULT_WIDTH,
  },
  projectRootPath: null,
  appearance: DEFAULT_APPEARANCE,
  chat: DEFAULT_CHAT_SETTINGS,
};
