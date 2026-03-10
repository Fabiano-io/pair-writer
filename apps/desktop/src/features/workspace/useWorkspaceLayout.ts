import { useCallback, useEffect, useRef, useState } from "react";
import { loadSettings } from "../settings/appSettings";
import { saveWorkspaceLayout } from "../settings/appSettings";
import {
  EXPLORER_MIN_WIDTH,
  EXPLORER_MAX_WIDTH,
  EXPLORER_DEFAULT_WIDTH,
  CHAT_MIN_WIDTH,
  CHAT_MAX_WIDTH,
  CHAT_DEFAULT_WIDTH,
  MIN_DOCUMENT_WIDTH,
} from "../settings/settingsDefaults";

export interface WorkspaceLayoutState {
  explorerWidth: number;
  chatWidth: number;
  isLoaded: boolean;
  explorerVisible: boolean;
  chatVisible: boolean;
  toggleExplorer: () => void;
  toggleChat: () => void;
  onExplorerResize: (delta: number) => void;
  onExplorerResizeEnd: () => void;
  onChatResize: (delta: number) => void;
  onChatResizeEnd: () => void;
}

export function useWorkspaceLayout(): WorkspaceLayoutState {
  const [explorerWidth, setExplorerWidth] = useState(EXPLORER_DEFAULT_WIDTH);
  const [chatWidth, setChatWidth] = useState(CHAT_DEFAULT_WIDTH);
  const [isLoaded, setIsLoaded] = useState(false);
  const [explorerVisible, setExplorerVisible] = useState(true);
  const [chatVisible, setChatVisible] = useState(true);

  const toggleExplorer = useCallback(() => setExplorerVisible((v) => !v), []);
  const toggleChat = useCallback(() => setChatVisible((v) => !v), []);

  const explorerRef = useRef(explorerWidth);
  const chatRef = useRef(chatWidth);

  useEffect(() => {
    loadSettings().then((settings) => {
      const ew = clamp(
        settings.workspaceLayout.explorerWidth,
        EXPLORER_MIN_WIDTH,
        EXPLORER_MAX_WIDTH
      );
      const cw = clamp(
        settings.workspaceLayout.chatWidth,
        CHAT_MIN_WIDTH,
        CHAT_MAX_WIDTH
      );
      setExplorerWidth(ew);
      setChatWidth(cw);
      explorerRef.current = ew;
      chatRef.current = cw;
      setIsLoaded(true);
    });
  }, []);

  const onExplorerResize = useCallback(
    (delta: number) => {
      const windowWidth = window.innerWidth;
      const maxAllowed = Math.min(
        EXPLORER_MAX_WIDTH,
        windowWidth - chatWidth - MIN_DOCUMENT_WIDTH
      );
      const newWidth = clamp(
        explorerRef.current + delta,
        EXPLORER_MIN_WIDTH,
        maxAllowed
      );
      explorerRef.current = newWidth;
      setExplorerWidth(newWidth);
    },
    [chatWidth]
  );

  const onExplorerResizeEnd = useCallback(() => {
    saveWorkspaceLayout({
      explorerWidth: explorerRef.current,
      chatWidth: chatRef.current,
    });
  }, []);

  const onChatResize = useCallback(
    (delta: number) => {
      const windowWidth = window.innerWidth;
      const maxAllowed = Math.min(
        CHAT_MAX_WIDTH,
        windowWidth - explorerWidth - MIN_DOCUMENT_WIDTH
      );
      // Chat resize is inverted: dragging left increases chat width
      const newWidth = clamp(
        chatRef.current - delta,
        CHAT_MIN_WIDTH,
        maxAllowed
      );
      chatRef.current = newWidth;
      setChatWidth(newWidth);
    },
    [explorerWidth]
  );

  const onChatResizeEnd = useCallback(() => {
    saveWorkspaceLayout({
      explorerWidth: explorerRef.current,
      chatWidth: chatRef.current,
    });
  }, []);

  return {
    explorerWidth,
    chatWidth,
    isLoaded,
    explorerVisible,
    chatVisible,
    toggleExplorer,
    toggleChat,
    onExplorerResize,
    onExplorerResizeEnd,
    onChatResize,
    onChatResizeEnd,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
