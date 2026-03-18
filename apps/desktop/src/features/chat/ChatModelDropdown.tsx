import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import type { ChatProvider, ChatModelCatalogEntry } from "../settings/settingsDefaults";
import { useTranslation } from "../settings/i18n/useTranslation";

interface ChatModelDropdownProps {
  models: ChatModelCatalogEntry[];
  selectedModelId: string | null;
  onSelect: (modelId: string) => void;
}

interface MenuPalette {
  triggerBackground: string;
  triggerHoverBackground: string;
  triggerBorder: string;
  triggerShadow: string;
  panelBackground: string;
  panelBorder: string;
  panelShadow: string;
  sectionLabelColor: string;
  separatorColor: string;
  titleColor: string;
  descriptionColor: string;
  hoverBackground: string;
  selectedBackground: string;
  selectedShadow: string;
  checkColor: string;
}

const PROVIDER_ORDER: ChatProvider[] = [
  "openai",
  "anthropic",
  "gemini",
  "openAiCompatible",
  "lmStudio",
];

const PROVIDER_LABELS: Record<ChatProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google",
  openAiCompatible: "Endpoint",
  lmStudio: "Local",
};

export function ChatModelDropdown({
  models,
  selectedModelId,
  onSelect,
}: ChatModelDropdownProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLDivElement>(null);

  const selectedModel =
    models.find((entry) => entry.id === selectedModelId) ?? models[0] ?? null;

  const groupedModels = useMemo(() => {
    const groups = new Map<ChatProvider, ChatModelCatalogEntry[]>();

    for (const model of models) {
      const entries = groups.get(model.provider);
      if (entries) {
        entries.push(model);
      } else {
        groups.set(model.provider, [model]);
      }
    }

    return PROVIDER_ORDER.filter((provider) => groups.has(provider)).map((provider) => ({
      provider,
      models: groups.get(provider) ?? [],
    }));
  }, [models]);

  const flatModels = useMemo(
    () => groupedModels.flatMap((group) => group.models),
    [groupedModels]
  );

  const themeHost =
    (triggerRef.current?.closest(".app-shell") as HTMLElement | null) ??
    (rootRef.current?.closest(".app-shell") as HTMLElement | null) ??
    null;
  const palette = getMenuPalette(themeHost);
  const portalTarget = themeHost ?? document.body;

  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = Math.max(
      0,
      flatModels.findIndex((entry) => entry.id === (selectedModel?.id ?? ""))
    );
    setActiveIndex(selectedIndex);
  }, [flatModels, isOpen, selectedModel]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    listboxRef.current?.focus();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePanelPosition = () => {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) return;

      const gap = 10;
      const viewportPadding = 14;
      const triggerRect = trigger.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();

      let left = triggerRect.left;
      const maxLeft = window.innerWidth - panelRect.width - viewportPadding;
      left = Math.min(Math.max(viewportPadding, left), Math.max(viewportPadding, maxLeft));

      const spaceAbove = triggerRect.top - viewportPadding;
      const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
      const shouldOpenUp = spaceAbove >= panelRect.height + gap || spaceAbove > spaceBelow;

      const rawTop = shouldOpenUp
        ? triggerRect.top - panelRect.height - gap
        : triggerRect.bottom + gap;
      const maxTop = window.innerHeight - panelRect.height - viewportPadding;
      const top = Math.min(Math.max(viewportPadding, rawTop), Math.max(viewportPadding, maxTop));

      setPanelPosition({ left, top });
    };

    const rafId = window.requestAnimationFrame(updatePanelPosition);
    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const option = listboxRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`
    );
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, isOpen]);

  function openDropdown() {
    if (flatModels.length === 0) return;
    setPanelPosition(null);
    setIsOpen(true);
  }

  function selectAndClose(modelId: string) {
    onSelect(modelId);
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDropdown();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      openDropdown();
      setActiveIndex((prev) => Math.min(flatModels.length - 1, prev + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      openDropdown();
      setActiveIndex((prev) => Math.max(0, prev - 1));
    }
  }

  function handleListboxKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (flatModels.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % flatModels.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + flatModels.length) % flatModels.length);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(flatModels.length - 1);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const activeModel = flatModels[activeIndex];
      if (activeModel) {
        selectAndClose(activeModel.id);
      }
      return;
    }

    if (event.key === "Tab") {
      setIsOpen(false);
    }
  }

  if (models.length === 0) {
    return (
      <span className="truncate text-[11px] text-[var(--app-text-muted)]">
        {t("chat_no_models")}
      </span>
    );
  }

  const triggerStyle: CSSProperties = {
    backgroundColor: isOpen ? palette.triggerHoverBackground : palette.triggerBackground,
    borderColor: palette.triggerBorder,
    boxShadow: palette.triggerShadow,
  };

  let optionIndex = 0;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        className="flex min-w-[210px] items-center gap-2.5 rounded-[8px] border px-3 py-2 text-[13px] font-semibold tracking-[-0.01em] transition-colors outline-none"
        style={triggerStyle}
        onClick={() => (isOpen ? setIsOpen(false) : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        aria-label={t("chat_model_select")}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <ModelGlyphIcon className="h-[17px] w-[17px] shrink-0 text-[var(--app-text-muted)]" />
        <span className="min-w-0 flex-1 truncate text-left text-[var(--app-text)]">
          {selectedModel?.name ?? t("chat_no_models")}
        </span>
        <ChevronIcon
          className={`h-3.5 w-3.5 shrink-0 text-[var(--app-text-muted)] transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="z-[140] w-[340px] max-w-[calc(100vw-24px)] rounded-[12px] border p-2"
            style={{
              position: "fixed",
              left: panelPosition?.left ?? -9999,
              top: panelPosition?.top ?? -9999,
              visibility: panelPosition ? "visible" : "hidden",
              backgroundColor: palette.panelBackground,
              borderColor: palette.panelBorder,
              boxShadow: palette.panelShadow,
            }}
          >
            <div
              ref={listboxRef}
              role="listbox"
              tabIndex={0}
              aria-label={t("chat_model_select")}
              onKeyDown={handleListboxKeyDown}
              className="max-h-[min(430px,calc(100vh-32px))] overflow-y-auto rounded-[10px] pr-2 outline-none"
            >
              {groupedModels.map((group, groupIndex) => (
                <div key={group.provider} className={groupIndex === 0 ? "pt-1" : "pt-3"}>
                  <p
                    className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    style={{ color: palette.sectionLabelColor }}
                  >
                    {PROVIDER_LABELS[group.provider]}
                  </p>

                  <div className="space-y-1">
                    {group.models.map((model) => {
                      const currentOptionIndex = optionIndex;
                      optionIndex += 1;

                      const isSelected = selectedModel?.id === model.id;
                      const isActive = currentOptionIndex === activeIndex;
                      const description = buildModelDescription(model, t);
                      const optionStyle: CSSProperties = isSelected
                        ? {
                            backgroundColor: palette.selectedBackground,
                            boxShadow: palette.selectedShadow,
                          }
                        : isActive
                          ? { backgroundColor: palette.hoverBackground }
                          : {};

                      return (
                        <button
                          key={model.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-option-index={currentOptionIndex}
                          className="mr-1 flex w-full items-start gap-3 rounded-[8px] px-3 py-3 text-left transition-colors"
                          style={optionStyle}
                          onClick={() => selectAndClose(model.id)}
                          onMouseEnter={() => setActiveIndex(currentOptionIndex)}
                        >
                          <ModelGlyphIcon className="mt-[3px] h-[17px] w-[17px] shrink-0 text-[var(--app-text-muted)]/72" />
                          <span className="min-w-0 flex-1">
                            <span
                              className="block truncate text-[15px] font-semibold leading-[1.15] tracking-[-0.02em]"
                              style={{ color: palette.titleColor }}
                            >
                              {model.name}
                            </span>
                            <span
                              className="block truncate pt-1 text-[12px] leading-[1.2]"
                              style={{ color: palette.descriptionColor }}
                            >
                              {description}
                            </span>
                          </span>
                          <span className="flex min-h-[24px] w-4 shrink-0 items-center justify-end">
                            {isSelected ? (
                              <CheckIcon className="h-4 w-4" style={{ color: palette.checkColor }} />
                            ) : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {groupIndex < groupedModels.length - 1 && (
                    <div
                      className="mx-3 mt-3 h-px rounded-full"
                      style={{ backgroundColor: palette.separatorColor }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>,
          portalTarget
        )}
    </div>
  );
}

function buildModelDescription(
  model: ChatModelCatalogEntry,
  t: (key: "chat_capability_think" | "chat_capability_tools" | "chat_capability_vision") => string
): string {
  const hints: string[] = [];
  if (model.supportsThinking) hints.push(t("chat_capability_think"));
  if (model.supportsTools) hints.push(t("chat_capability_tools"));
  if (model.supportsVision) hints.push(t("chat_capability_vision"));
  return hints.length > 0 ? hints.join(" · ") : model.modelId;
}

function getMenuPalette(themeHost: HTMLElement | null): MenuPalette {
  const computed = themeHost ? getComputedStyle(themeHost) : null;
  const background = computed?.getPropertyValue("--app-bg").trim() || "rgb(9, 9, 11)";
  const surface = computed?.getPropertyValue("--app-surface").trim() || "rgb(24, 24, 27)";
  const surfaceAlt = computed?.getPropertyValue("--app-surface-alt").trim() || "rgb(39, 39, 42)";
  const border = computed?.getPropertyValue("--app-border").trim() || "rgb(39, 39, 42)";
  const text = computed?.getPropertyValue("--app-text").trim() || "rgb(250, 250, 250)";
  const muted = computed?.getPropertyValue("--app-text-muted").trim() || "rgb(161, 161, 170)";
  const isLight = getColorLuminance(background) > 0.6;

  return {
    triggerBackground: isLight ? surface : background,
    triggerHoverBackground: isLight ? withAlpha(surfaceAlt, 0.58) : withAlpha(surfaceAlt, 0.28),
    triggerBorder: withAlpha(border, isLight ? 0.9 : 1),
    triggerShadow: "none",
    panelBackground: surface,
    panelBorder: withAlpha(border, isLight ? 0.9 : 1),
    panelShadow: isLight
      ? "0 8px 18px rgba(15, 23, 42, 0.06)"
      : "0 10px 18px rgba(0, 0, 0, 0.16)",
    sectionLabelColor: isLight ? withAlpha(muted, 0.78) : withAlpha(text, 0.58),
    separatorColor: isLight ? withAlpha(border, 0.72) : withAlpha(text, 0.09),
    titleColor: text,
    descriptionColor: isLight ? withAlpha(muted, 0.92) : withAlpha(text, 0.54),
    hoverBackground: isLight ? withAlpha(surfaceAlt, 0.34) : withAlpha(surfaceAlt, 0.18),
    selectedBackground: isLight ? withAlpha(surfaceAlt, 0.72) : withAlpha(surfaceAlt, 0.3),
    selectedShadow: "none",
    checkColor: isLight ? "rgb(37, 99, 235)" : "rgb(147, 197, 253)",
  };
}

function ModelGlyphIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="5.5" y="5.5" width="9" height="9" rx="2.4" />
      <path d="M8 3.6h4" />
      <path d="M8 16.4h4" />
      <path d="M3.6 8v4" />
      <path d="M16.4 8v4" />
    </svg>
  );
}

function withAlpha(color: string, alpha: number): string {
  const parsed = parseColor(color);
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`;
}

function getColorLuminance(color: string): number {
  const { r, g, b } = parseColor(color);
  const channels = [r, g, b].map((value) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function parseColor(color: string): { r: number; g: number; b: number } {
  const value = color.trim();

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    if (hex.length === 3) {
      return {
        r: parseInt(`${hex[0]}${hex[0]}`, 16),
        g: parseInt(`${hex[1]}${hex[1]}`, 16),
        b: parseInt(`${hex[2]}${hex[2]}`, 16),
      };
    }

    if (hex.length >= 6) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      };
    }
  }

  const parts = value.match(/[\d.]+/g);
  if (parts && parts.length >= 3) {
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
    };
  }

  return { r: 24, g: 24, b: 27 };
}

function ChevronIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="m5 7 5 6 5-6" />
    </svg>
  );
}

function CheckIcon({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <path d="m4.5 10.5 3.1 3.1L15.5 6" />
    </svg>
  );
}
