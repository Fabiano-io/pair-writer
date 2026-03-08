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

export interface AppSettings {
  version: number;
  window: WindowSettings;
  workspaceLayout: WorkspaceLayoutSettings;
}

export const EXPLORER_MIN_WIDTH = 180;
export const EXPLORER_MAX_WIDTH = 420;
export const EXPLORER_DEFAULT_WIDTH = 260;

export const CHAT_MIN_WIDTH = 260;
export const CHAT_MAX_WIDTH = 520;
export const CHAT_DEFAULT_WIDTH = 340;

export const MIN_DOCUMENT_WIDTH = 300;

export const DEFAULT_SETTINGS: AppSettings = {
  version: 1,
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
};
