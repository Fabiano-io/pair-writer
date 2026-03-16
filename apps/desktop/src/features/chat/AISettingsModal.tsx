import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type SVGProps,
} from "react";
import { useDialogA11y } from "../../components/useDialogA11y";
import { loadAppDataDirectory } from "../settings/appSettings";
import { useTranslation } from "../settings/i18n/useTranslation";
import type {
  ChatGeneralSettings,
  ChatModelCatalogEntry,
  ChatProvider,
  ChatSettings,
} from "../settings/settingsDefaults";
import { DEFAULT_CHAT_SETTINGS } from "../settings/settingsDefaults";
import {
  deleteApiKey,
  hasApiKey,
  saveApiKey,
  testProviderConnection,
  type ApiCredentialService,
} from "./chatCredentials";
import { loadChatSettings, saveChatSettings } from "./chatSettings";

type CloudProvider = Extract<ChatProvider, "openai" | "anthropic" | "gemini">;
type EndpointProvider = Extract<ChatProvider, "lmStudio" | "openAiCompatible">;
type ModalSection = "providers" | "models" | "general";
type StatusTone = "neutral" | "success" | "danger" | "info";

interface AISettingsModalProps {
  onClose: () => void;
  onSettingsChanged: () => void;
}

interface ProviderStatus {
  labelKey:
    | "ai_status_not_configured"
    | "ai_status_not_tested"
    | "ai_status_valid"
    | "ai_status_invalid"
    | "ai_status_testing"
    | "ai_status_saving"
    | "ai_status_removing"
    | "ai_status_online"
    | "ai_status_offline";
  tone: StatusTone;
  detail?: string;
}

interface SecretProviderState {
  apiKeyDraft: string;
  showDraft: boolean;
  hasStoredKey: boolean;
  status: ProviderStatus;
}

interface EndpointProviderState extends SecretProviderState {
  displayName: string;
  endpointUrl: string;
}

interface NewModelDraft {
  name: string;
  modelId: string;
  provider: ChatProvider;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsThinking: boolean;
}

const CLOUD_META: {
  id: CloudProvider;
  badge: string;
  badgeClass: string;
  title: string;
  subtitleKey:
    | "ai_provider_anthropic_subtitle"
    | "ai_provider_openai_subtitle"
    | "ai_provider_gemini_subtitle";
}[] = [
  {
    id: "anthropic",
    badge: "AN",
    badgeClass: "bg-violet-100 text-violet-700",
    title: "Anthropic",
    subtitleKey: "ai_provider_anthropic_subtitle",
  },
  {
    id: "openai",
    badge: "OA",
    badgeClass: "bg-emerald-100 text-emerald-700",
    title: "OpenAI",
    subtitleKey: "ai_provider_openai_subtitle",
  },
  {
    id: "gemini",
    badge: "GM",
    badgeClass: "bg-amber-100 text-amber-700",
    title: "Google Gemini",
    subtitleKey: "ai_provider_gemini_subtitle",
  },
];

const PROVIDER_TAG_CLASSES: Record<ChatProvider, string> = {
  anthropic:
    "border border-violet-400/20 bg-violet-500/10 text-violet-100",
  openai:
    "border border-emerald-400/20 bg-emerald-500/10 text-emerald-100",
  gemini:
    "border border-amber-400/20 bg-amber-500/10 text-amber-100",
  lmStudio:
    "border border-[color:var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-muted)]",
  openAiCompatible:
    "border border-sky-400/20 bg-sky-500/10 text-sky-100",
};

const INPUT_CLASS =
  "h-8 w-full rounded-md border border-[color:var(--app-border)] bg-[var(--app-bg)] px-2.5 text-xs text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/55 focus-visible:border-[var(--app-text-muted)]/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/25";

const BUTTON_BASE_CLASS =
  "inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/25";

const SECONDARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} border-[color:var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text)] hover:bg-[var(--app-surface-alt)]`;
const PRIMARY_BUTTON_CLASS = `${BUTTON_BASE_CLASS} border-transparent bg-[var(--app-text)] text-[var(--app-bg)] hover:opacity-92`;
const DANGER_BUTTON_CLASS = `${BUTTON_BASE_CLASS} border-[color:var(--app-border)] bg-transparent px-2.5 text-[var(--app-text-muted)] hover:border-red-400/25 hover:bg-red-500/8 hover:text-red-100`;

const STATUS_NOT_CONFIGURED: ProviderStatus = {
  labelKey: "ai_status_not_configured",
  tone: "neutral",
};

const STATUS_NOT_TESTED: ProviderStatus = {
  labelKey: "ai_status_not_tested",
  tone: "neutral",
};

const EMPTY_NEW_MODEL: NewModelDraft = {
  name: "",
  modelId: "",
  provider: "anthropic",
  supportsVision: false,
  supportsTools: false,
  supportsThinking: false,
};

export function AISettingsModal({
  onClose,
  onSettingsChanged,
}: AISettingsModalProps) {
  const { t } = useTranslation();
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [activeSection, setActiveSection] = useState<ModalSection>("providers");
  const [chatDraft, setChatDraft] = useState<ChatSettings>(() =>
    cloneChatSettings(DEFAULT_CHAT_SETTINGS)
  );
  const [cloudCards, setCloudCards] = useState<Record<CloudProvider, SecretProviderState>>({
    anthropic: createSecretProviderState(false),
    openai: createSecretProviderState(false),
    gemini: createSecretProviderState(false),
  });
  const [lmStudioCard, setLmStudioCard] = useState<EndpointProviderState>(
    createEndpointProviderState("LM Studio", "http://127.0.0.1:1234", false)
  );
  const [openAiCompatibleCard, setOpenAiCompatibleCard] =
    useState<EndpointProviderState>(
      createEndpointProviderState("OpenAI-Compatible", "http://127.0.0.1:1234", false)
    );
  const [dataDirectory, setDataDirectory] = useState("--");
  const [isAddModelOpen, setIsAddModelOpen] = useState(false);
  const [newModel, setNewModel] = useState<NewModelDraft>(EMPTY_NEW_MODEL);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const dialogRef = useDialogA11y({
    isOpen: true,
    onClose: handleClose,
    initialFocusRef: closeButtonRef,
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const [
        settings,
        anthropicStored,
        openaiStored,
        geminiStored,
        lmStudioStored,
        openAiCompatibleStored,
        appDataDir,
      ] = await Promise.all([
        loadChatSettings(),
        hasApiKey("anthropic"),
        hasApiKey("openai"),
        hasApiKey("gemini"),
        hasApiKey("lmStudio"),
        hasApiKey("openAiCompatible"),
        loadAppDataDirectory().catch(() => "--"),
      ]);

      if (cancelled) return;

      const syncedSettings = syncChatSettings(settings);
      setChatDraft(syncedSettings);
      setCloudCards({
        anthropic: createSecretProviderState(anthropicStored),
        openai: createSecretProviderState(openaiStored),
        gemini: createSecretProviderState(geminiStored),
      });
      setLmStudioCard(
        createEndpointProviderState(
          "LM Studio",
          syncedSettings.lmStudio.endpointUrl,
          lmStudioStored
        )
      );
      setOpenAiCompatibleCard(
        createEndpointProviderState(
          syncedSettings.openAiCompatible.displayName,
          syncedSettings.openAiCompatible.endpointUrl,
          openAiCompatibleStored
        )
      );
      setDataDirectory(appDataDir || "--");
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistChat = useCallback(
    async (nextChat: ChatSettings) => {
      const synced = syncChatSettings(nextChat);
      setChatDraft(synced);
      await saveChatSettings(synced);
      onSettingsChanged();
    },
    [onSettingsChanged]
  );

  const updateCloudCard = useCallback(
    (
      provider: CloudProvider,
      recipe: (current: SecretProviderState) => SecretProviderState
    ) => {
      setCloudCards((current) => ({
        ...current,
        [provider]: recipe(current[provider]),
      }));
    },
    []
  );

  const updateEndpointCard = useCallback(
    (
      provider: EndpointProvider,
      recipe: (current: EndpointProviderState) => EndpointProviderState
    ) => {
      if (provider === "lmStudio") {
        setLmStudioCard(recipe);
        return;
      }

      setOpenAiCompatibleCard(recipe);
    },
    []
  );

  const handleCloudSave = useCallback(
    async (provider: CloudProvider) => {
      const card = cloudCards[provider];

      if (!card.apiKeyDraft.trim() && !card.hasStoredKey) {
        updateCloudCard(provider, (current) => ({
          ...current,
          status: STATUS_NOT_CONFIGURED,
        }));
        return;
      }

      updateCloudCard(provider, (current) => ({
        ...current,
        status: { labelKey: "ai_status_saving", tone: "info" },
      }));

      try {
        if (card.apiKeyDraft.trim()) {
          await saveApiKey(provider, card.apiKeyDraft.trim());
        }

        updateCloudCard(provider, (current) => ({
          ...current,
          apiKeyDraft: "",
          hasStoredKey: current.hasStoredKey || card.apiKeyDraft.trim().length > 0,
          status: STATUS_NOT_TESTED,
        }));

        onSettingsChanged();
      } catch (error) {
        updateCloudCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_invalid",
            tone: "danger",
            detail: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [cloudCards, onSettingsChanged, updateCloudCard]
  );

  const handleCloudTest = useCallback(
    async (provider: CloudProvider) => {
      const card = cloudCards[provider];

      if (card.apiKeyDraft.trim()) {
        await handleCloudSave(provider);
      } else if (!card.hasStoredKey) {
        updateCloudCard(provider, (current) => ({
          ...current,
          status: STATUS_NOT_CONFIGURED,
        }));
        return;
      }

      updateCloudCard(provider, (current) => ({
        ...current,
        status: { labelKey: "ai_status_testing", tone: "info" },
      }));

      try {
        const result = await testProviderConnection(provider, {
          model: resolvePrimaryModelId(
            chatDraft.models,
            provider,
            chatDraft[provider].model
          ),
        });
        updateCloudCard(provider, (current) => ({
          ...current,
          hasStoredKey: true,
          status: {
            labelKey: result.ok ? "ai_status_valid" : "ai_status_invalid",
            tone: result.ok ? "success" : "danger",
            detail: result.message,
          },
        }));
      } catch (error) {
        updateCloudCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_invalid",
            tone: "danger",
            detail: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [chatDraft, cloudCards, handleCloudSave, updateCloudCard]
  );

  const handleRemoveKey = useCallback(
    async (service: ApiCredentialService, label: string, reset: () => void) => {
      if (!window.confirm(`${t("ai_remove_confirm")} ${label}?`)) {
        return;
      }

      reset();

      try {
        await deleteApiKey(service);
        onSettingsChanged();
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);

        if (service === "lmStudio" || service === "openAiCompatible") {
          updateEndpointCard(service, (current) => ({
            ...current,
            status: {
              labelKey: "ai_status_invalid",
              tone: "danger",
              detail,
            },
          }));
          return;
        }

        updateCloudCard(service, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_invalid",
            tone: "danger",
            detail,
          },
        }));
      }
    },
    [onSettingsChanged, t, updateCloudCard, updateEndpointCard]
  );

  const handleEndpointSave = useCallback(
    async (provider: EndpointProvider) => {
      const card = provider === "lmStudio" ? lmStudioCard : openAiCompatibleCard;
      const endpointUrl = card.endpointUrl.trim();
      const displayName = card.displayName.trim();

      if (!endpointUrl) {
        updateEndpointCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_invalid",
            tone: "danger",
            detail: t("ai_error_missing_endpoint"),
          },
        }));
        return;
      }

      if (provider === "openAiCompatible" && !displayName) {
        updateEndpointCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_invalid",
            tone: "danger",
            detail: t("ai_provider_name_placeholder"),
          },
        }));
        return;
      }

      updateEndpointCard(provider, (current) => ({
        ...current,
        status: { labelKey: "ai_status_saving", tone: "info" },
      }));

      try {
        if (card.apiKeyDraft.trim()) {
          await saveApiKey(provider, card.apiKeyDraft.trim());
        }

        const nextChat =
          provider === "lmStudio"
            ? {
                ...chatDraft,
                lmStudio: {
                  ...chatDraft.lmStudio,
                  endpointUrl,
                },
              }
            : {
                ...chatDraft,
                openAiCompatible: {
                  ...chatDraft.openAiCompatible,
                  displayName,
                  endpointUrl,
                },
              };

        await persistChat(nextChat);

        updateEndpointCard(provider, (current) => ({
          ...current,
          displayName: provider === "lmStudio" ? current.displayName : displayName,
          endpointUrl,
          apiKeyDraft: "",
          hasStoredKey: current.hasStoredKey || card.apiKeyDraft.trim().length > 0,
          status: STATUS_NOT_TESTED,
        }));
      } catch (error) {
        updateEndpointCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_invalid",
            tone: "danger",
            detail: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [chatDraft, lmStudioCard, openAiCompatibleCard, persistChat, t, updateEndpointCard]
  );

  const handleEndpointTest = useCallback(
    async (provider: EndpointProvider) => {
      const card = provider === "lmStudio" ? lmStudioCard : openAiCompatibleCard;

      if (card.apiKeyDraft.trim()) {
        await handleEndpointSave(provider);
      } else if (!card.endpointUrl.trim()) {
        updateEndpointCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_offline",
            tone: "danger",
            detail: t("ai_error_missing_endpoint"),
          },
        }));
        return;
      }

      updateEndpointCard(provider, (current) => ({
        ...current,
        status: { labelKey: "ai_status_testing", tone: "info" },
      }));

      try {
        const fallbackModel =
          provider === "lmStudio"
            ? chatDraft.lmStudio.model
            : chatDraft.openAiCompatible.model;
        const result = await testProviderConnection(provider, {
          endpointUrl: card.endpointUrl.trim(),
          model: resolvePrimaryModelId(chatDraft.models, provider, fallbackModel),
        });
        updateEndpointCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: result.ok ? "ai_status_online" : "ai_status_offline",
            tone: result.ok ? "success" : "danger",
            detail: result.message,
          },
        }));
      } catch (error) {
        updateEndpointCard(provider, (current) => ({
          ...current,
          status: {
            labelKey: "ai_status_offline",
            tone: "danger",
            detail: error instanceof Error ? error.message : String(error),
          },
        }));
      }
    },
    [chatDraft, handleEndpointSave, lmStudioCard, openAiCompatibleCard, t, updateEndpointCard]
  );

  const handleProviderChange = useCallback(
    (provider: ChatProvider) => {
      const nextChat = {
        ...chatDraft,
        provider,
      };

      setChatDraft(syncChatSettings(nextChat));
      void persistChat(nextChat);
    },
    [chatDraft, persistChat]
  );

  const handleGeneralChange = useCallback(
    (key: keyof ChatGeneralSettings, value: boolean) => {
      const nextChat = {
        ...chatDraft,
        general: {
          ...chatDraft.general,
          [key]: value,
        },
      };

      setChatDraft(syncChatSettings(nextChat));
      void persistChat(nextChat);
    },
    [chatDraft, persistChat]
  );

  const handleModelToggle = useCallback(
    (id: string, enabled: boolean) => {
      const nextChat = {
        ...chatDraft,
        models: chatDraft.models.map((entry) =>
          entry.id === id ? { ...entry, enabled } : entry
        ),
      };

      setChatDraft(syncChatSettings(nextChat));
      void persistChat(nextChat);
    },
    [chatDraft, persistChat]
  );

  const handleModelRemove = useCallback(
    (id: string) => {
      const nextChat = {
        ...chatDraft,
        models: chatDraft.models.filter((entry) => entry.id !== id),
      };

      setChatDraft(syncChatSettings(nextChat));
      void persistChat(nextChat);
    },
    [chatDraft, persistChat]
  );

  const handleModelCapabilityToggle = useCallback(
    (
      id: string,
      capability: "supportsVision" | "supportsTools" | "supportsThinking",
      enabled: boolean
    ) => {
      const nextChat = {
        ...chatDraft,
        models: chatDraft.models.map((entry) =>
          entry.id === id ? { ...entry, [capability]: enabled } : entry
        ),
      };

      setChatDraft(syncChatSettings(nextChat));
      void persistChat(nextChat);
    },
    [chatDraft, persistChat]
  );

  const handleAddModel = useCallback(() => {
    const name = newModel.name.trim();
    const modelId = newModel.modelId.trim();

    if (!name || !modelId) {
      return;
    }

    const nextChat = {
      ...chatDraft,
      models: [
        ...chatDraft.models,
        {
          id: `model-${Date.now()}`,
          name,
          provider: newModel.provider,
          modelId,
          enabled: true,
          supportsVision: newModel.supportsVision,
          supportsTools: newModel.supportsTools,
          supportsThinking: newModel.supportsThinking,
        },
      ],
    };

    setChatDraft(syncChatSettings(nextChat));
    setNewModel(EMPTY_NEW_MODEL);
    setIsAddModelOpen(false);
    void persistChat(nextChat);
  }, [chatDraft, newModel, persistChat]);

  const sectionCopy: Record<
    ModalSection,
    {
      titleKey: "ai_section_providers" | "ai_section_models" | "ai_section_general";
      descriptionKey:
        | "ai_section_providers_description"
        | "ai_section_models_description"
        | "ai_section_general_description";
    }
  > = {
    providers: {
      titleKey: "ai_section_providers",
      descriptionKey: "ai_section_providers_description",
    },
    models: {
      titleKey: "ai_section_models",
      descriptionKey: "ai_section_models_description",
    },
    general: {
      titleKey: "ai_section_general",
      descriptionKey: "ai_section_general_description",
    },
  };

  const providerOptions = buildProviderOptions(
    t,
    openAiCompatibleCard.displayName.trim()
  );

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
        className="flex h-[min(82vh,640px)] w-full max-w-[860px] overflow-hidden rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] shadow-[0_30px_90px_rgba(0,0,0,0.48)]"
        onClick={(event) => event.stopPropagation()}
      >
        <aside className="flex w-[180px] shrink-0 flex-col border-r border-[color:var(--app-border)] bg-black/10 py-5">
          <div className="px-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]/80">
              {t("ai_settings_kicker")}
            </p>
          </div>

          <nav className="mt-4 flex flex-col gap-0.5">
            <SidebarButton
              active={activeSection === "providers"}
              label={t("ai_section_providers")}
              icon={ProvidersIcon}
              onClick={() => setActiveSection("providers")}
            />
            <SidebarButton
              active={activeSection === "models"}
              label={t("ai_section_models")}
              icon={ModelsIcon}
              onClick={() => setActiveSection("models")}
            />
            <SidebarButton
              active={activeSection === "general"}
              label={t("ai_section_general")}
              icon={GeneralIcon}
              onClick={() => setActiveSection("general")}
            />
          </nav>

          <p className="mt-auto px-4 text-[10px] leading-4 text-[var(--app-text-muted)]/78">
            {t("ai_settings_description")}
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-[color:var(--app-border)] px-6 py-4">
            <div className="min-w-0">
              <h3 id={titleId} className="text-[15px] font-medium tracking-tight text-[var(--app-text)]">
                {t(sectionCopy[activeSection].titleKey)}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                {t(sectionCopy[activeSection].descriptionKey)}
              </p>
            </div>

            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className={SECONDARY_BUTTON_CLASS}
            >
              {t("ai_close")}
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {activeSection === "providers" ? (
              <div className="space-y-4">
                {CLOUD_META.map((providerMeta) => (
                  <ProviderCardShell
                    key={providerMeta.id}
                    badge={providerMeta.badge}
                    badgeClass={providerMeta.badgeClass}
                    title={providerMeta.title}
                    subtitle={t(providerMeta.subtitleKey)}
                    status={cloudCards[providerMeta.id].status}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex flex-col gap-2 xl:flex-row">
                        <SecretInput
                          value={cloudCards[providerMeta.id].apiKeyDraft}
                          showValue={cloudCards[providerMeta.id].showDraft}
                          hasStoredKey={cloudCards[providerMeta.id].hasStoredKey}
                          placeholder={t("ai_key_placeholder")}
                          onChange={(value) => {
                            updateCloudCard(providerMeta.id, (current) => ({
                              ...current,
                              apiKeyDraft: value,
                            }));
                          }}
                          onToggleShow={() => {
                            updateCloudCard(providerMeta.id, (current) => ({
                              ...current,
                              showDraft: !current.showDraft,
                            }));
                          }}
                        />

                        <ProviderActions
                          canRemove={cloudCards[providerMeta.id].hasStoredKey}
                          onTest={() => {
                            void handleCloudTest(providerMeta.id);
                          }}
                          onSave={() => {
                            void handleCloudSave(providerMeta.id);
                          }}
                          onRemove={() => {
                            void handleRemoveKey(providerMeta.id, providerMeta.title, () => {
                              updateCloudCard(providerMeta.id, (current) => ({
                                ...current,
                                apiKeyDraft: "",
                                showDraft: false,
                                hasStoredKey: false,
                                status: { labelKey: "ai_status_removing", tone: "info" },
                              }));
                            });
                          }}
                        />
                      </div>

                      <p className="text-[11px] leading-4 text-[var(--app-text-muted)]">
                        {cloudCards[providerMeta.id].hasStoredKey
                          ? t("ai_key_stored_inline")
                          : t("ai_key_not_stored_inline")}
                      </p>
                    </div>
                  </ProviderCardShell>
                ))}

                <ProviderCardShell
                  badge="LM"
                  badgeClass="border border-[color:var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-muted)]"
                  title="LM Studio"
                  subtitle={t("ai_provider_lmstudio_subtitle")}
                  status={lmStudioCard.status}
                >
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={lmStudioCard.endpointUrl}
                      onChange={(event) => {
                        setLmStudioCard((current) => ({
                          ...current,
                          endpointUrl: event.target.value,
                        }));
                      }}
                      inputMode="url"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={t("ai_endpoint_placeholder")}
                      className={`${INPUT_CLASS} font-mono`}
                    />

                    <div className="flex flex-col gap-2 xl:flex-row">
                      <SecretInput
                        value={lmStudioCard.apiKeyDraft}
                        showValue={lmStudioCard.showDraft}
                        hasStoredKey={lmStudioCard.hasStoredKey}
                        placeholder={t("ai_api_key_optional_label")}
                        onChange={(value) => {
                          setLmStudioCard((current) => ({
                            ...current,
                            apiKeyDraft: value,
                          }));
                        }}
                        onToggleShow={() => {
                          setLmStudioCard((current) => ({
                            ...current,
                            showDraft: !current.showDraft,
                          }));
                        }}
                      />

                      <ProviderActions
                        canRemove={lmStudioCard.hasStoredKey}
                        onTest={() => {
                          void handleEndpointTest("lmStudio");
                        }}
                        onSave={() => {
                          void handleEndpointSave("lmStudio");
                        }}
                        onRemove={() => {
                          void handleRemoveKey("lmStudio", "LM Studio", () => {
                            setLmStudioCard((current) => ({
                              ...current,
                              apiKeyDraft: "",
                              showDraft: false,
                              hasStoredKey: false,
                              status: { labelKey: "ai_status_removing", tone: "info" },
                            }));
                          });
                        }}
                      />
                    </div>

                    <p className="text-[11px] leading-4 text-[var(--app-text-muted)]">
                      {lmStudioCard.hasStoredKey
                        ? t("ai_key_stored_inline")
                        : t("ai_key_optional_hint")}
                    </p>
                  </div>
                </ProviderCardShell>

                <ProviderCardShell
                  badge="OA"
                  badgeClass="border border-sky-400/20 bg-sky-500/10 text-sky-100"
                  title={
                    openAiCompatibleCard.displayName.trim() ||
                    t("ai_provider_openai_compatible_title")
                  }
                  subtitle={t("ai_provider_openai_compatible_subtitle")}
                  status={openAiCompatibleCard.status}
                >
                  <div className="space-y-2">
                    <div className="grid gap-2 lg:grid-cols-[minmax(0,0.35fr)_minmax(0,0.65fr)]">
                      <input
                        type="text"
                        value={openAiCompatibleCard.displayName}
                        onChange={(event) => {
                          setOpenAiCompatibleCard((current) => ({
                            ...current,
                            displayName: event.target.value,
                          }));
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("ai_provider_name_placeholder")}
                        className={INPUT_CLASS}
                      />
                      <input
                        type="url"
                        value={openAiCompatibleCard.endpointUrl}
                        onChange={(event) => {
                          setOpenAiCompatibleCard((current) => ({
                            ...current,
                            endpointUrl: event.target.value,
                          }));
                        }}
                        inputMode="url"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("ai_endpoint_placeholder")}
                        className={`${INPUT_CLASS} font-mono`}
                      />
                    </div>

                    <div className="flex flex-col gap-2 xl:flex-row">
                      <SecretInput
                        value={openAiCompatibleCard.apiKeyDraft}
                        showValue={openAiCompatibleCard.showDraft}
                        hasStoredKey={openAiCompatibleCard.hasStoredKey}
                        placeholder={t("ai_api_key_optional_label")}
                        onChange={(value) => {
                          setOpenAiCompatibleCard((current) => ({
                            ...current,
                            apiKeyDraft: value,
                          }));
                        }}
                        onToggleShow={() => {
                          setOpenAiCompatibleCard((current) => ({
                            ...current,
                            showDraft: !current.showDraft,
                          }));
                        }}
                      />

                      <ProviderActions
                        canRemove={openAiCompatibleCard.hasStoredKey}
                        onTest={() => {
                          void handleEndpointTest("openAiCompatible");
                        }}
                        onSave={() => {
                          void handleEndpointSave("openAiCompatible");
                        }}
                        onRemove={() => {
                          void handleRemoveKey(
                            "openAiCompatible",
                            openAiCompatibleCard.displayName.trim() ||
                              t("ai_provider_openai_compatible_title"),
                            () => {
                              setOpenAiCompatibleCard((current) => ({
                                ...current,
                                apiKeyDraft: "",
                                showDraft: false,
                                hasStoredKey: false,
                                status: { labelKey: "ai_status_removing", tone: "info" },
                              }));
                            }
                          );
                        }}
                      />
                    </div>

                    <p className="text-[11px] leading-4 text-[var(--app-text-muted)]">
                      {openAiCompatibleCard.hasStoredKey
                        ? t("ai_key_stored_inline")
                        : t("ai_key_optional_hint")}
                    </p>
                  </div>
                </ProviderCardShell>
              </div>
            ) : null}

            {activeSection === "models" ? (
              <div className="space-y-3">
                <section className="rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="text-[13px] font-medium text-[var(--app-text)]">
                        {t("ai_section_models")}
                      </h4>
                      <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                        {t("ai_section_models_description")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAddModelOpen((current) => !current)}
                      className={SECONDARY_BUTTON_CLASS}
                    >
                      {t("ai_models_add")}
                    </button>
                  </div>

                  {isAddModelOpen ? (
                    <div className="mt-4 rounded-lg border border-dashed border-[color:var(--app-border)] bg-[var(--app-bg)] p-4">
                      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.72fr)]">
                        <input
                          type="text"
                          value={newModel.name}
                          onChange={(event) => {
                            setNewModel((current) => ({
                              ...current,
                              name: event.target.value,
                            }));
                          }}
                          autoComplete="off"
                          spellCheck={false}
                          placeholder={t("ai_model_name_placeholder")}
                          className={INPUT_CLASS}
                        />
                        <select
                          value={newModel.provider}
                          onChange={(event) => {
                            setNewModel((current) => ({
                              ...current,
                              provider: event.target.value as ChatProvider,
                            }));
                          }}
                          className={INPUT_CLASS}
                        >
                          {providerOptions.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <input
                        type="text"
                        value={newModel.modelId}
                        onChange={(event) => {
                          setNewModel((current) => ({
                            ...current,
                            modelId: event.target.value,
                          }));
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("ai_model_id_placeholder")}
                        className={`${INPUT_CLASS} mt-2 font-mono`}
                      />

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[color:var(--app-border)] bg-[var(--app-surface)] px-3 py-2">
                        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]/80">
                          Capabilities
                        </span>
                        <div className="flex items-center gap-1.5">
                          <CapabilityToggle
                            title="Vision"
                            enabled={newModel.supportsVision}
                            onChange={(enabled) => {
                              setNewModel((current) => ({
                                ...current,
                                supportsVision: enabled,
                              }));
                            }}
                            icon={EyeIcon}
                          />
                          <CapabilityToggle
                            title="Tools"
                            enabled={newModel.supportsTools}
                            onChange={(enabled) => {
                              setNewModel((current) => ({
                                ...current,
                                supportsTools: enabled,
                              }));
                            }}
                            icon={ToolIcon}
                          />
                          <CapabilityToggle
                            title="Think"
                            enabled={newModel.supportsThinking}
                            onChange={(enabled) => {
                              setNewModel((current) => ({
                                ...current,
                                supportsThinking: enabled,
                              }));
                            }}
                            icon={ThinkIcon}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddModelOpen(false);
                            setNewModel(EMPTY_NEW_MODEL);
                          }}
                          className={SECONDARY_BUTTON_CLASS}
                        >
                          {t("ai_cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={handleAddModel}
                          className={PRIMARY_BUTTON_CLASS}
                        >
                          {t("ai_add")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>

                {chatDraft.models.length === 0 ? (
                  <section className="rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                    <h4 className="text-[13px] font-medium text-[var(--app-text)]">
                      {t("ai_models_empty_title")}
                    </h4>
                    <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                      {t("ai_models_empty_description")}
                    </p>
                  </section>
                ) : (
                  chatDraft.models.map((model) => {
                    const primaryId = getPrimaryModelEntryId(
                      chatDraft.models,
                      model.provider
                    );

                    return (
                      <section
                        key={model.id}
                        className="flex flex-col gap-3 rounded-md border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-3 sm:flex-row sm:items-center"
                      >
                        <Toggle
                          checked={model.enabled}
                          onChange={(checked) => handleModelToggle(model.id, checked)}
                          ariaLabel={model.name}
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-[13px] font-medium text-[var(--app-text)]">
                              {model.name}
                            </h4>
                            {primaryId === model.id ? (
                              <span className="rounded border border-[color:var(--app-border)] bg-[var(--app-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--app-text-muted)]">
                                {t("ai_model_default_badge")}
                              </span>
                            ) : null}
                          </div>
                          <p className="truncate font-mono text-[11px] text-[var(--app-text-muted)]">
                            {model.modelId}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="hidden items-center gap-1.5 sm:flex">
                            <CapabilityToggle
                              title="Vision"
                              enabled={model.supportsVision === true}
                              onChange={(enabled) =>
                                handleModelCapabilityToggle(
                                  model.id,
                                  "supportsVision",
                                  enabled
                                )
                              }
                              icon={EyeIcon}
                            />
                            <CapabilityToggle
                              title="Tools"
                              enabled={model.supportsTools === true}
                              onChange={(enabled) =>
                                handleModelCapabilityToggle(
                                  model.id,
                                  "supportsTools",
                                  enabled
                                )
                              }
                              icon={ToolIcon}
                            />
                            <CapabilityToggle
                              title="Think"
                              enabled={model.supportsThinking === true}
                              onChange={(enabled) =>
                                handleModelCapabilityToggle(
                                  model.id,
                                  "supportsThinking",
                                  enabled
                                )
                              }
                              icon={ThinkIcon}
                            />
                          </div>
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${PROVIDER_TAG_CLASSES[model.provider]}`}
                          >
                            {getProviderLabel(
                              model.provider,
                              openAiCompatibleCard.displayName.trim()
                            )}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleModelRemove(model.id)}
                            className={DANGER_BUTTON_CLASS}
                          >
                            {t("ai_remove")}
                          </button>
                        </div>
                      </section>
                    );
                  })
                )}
              </div>
            ) : null}

            {activeSection === "general" ? (
              <div className="space-y-3">
                <section className="rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <label
                    htmlFor="default-provider"
                    className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--app-text-muted)]/75"
                  >
                    {t("ai_general_provider_label")}
                  </label>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    {t("ai_general_provider_description")}
                  </p>
                  <select
                    id="default-provider"
                    value={chatDraft.provider}
                    onChange={(event) =>
                      handleProviderChange(event.target.value as ChatProvider)
                    }
                    className={`${INPUT_CLASS} mt-3`}
                  >
                    {providerOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </section>

                <section className="rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-2">
                  <GeneralToggleRow
                    title={t("ai_general_save_history_title")}
                    description={t("ai_general_save_history_description")}
                    checked={chatDraft.general.saveHistory}
                    onChange={(checked) => handleGeneralChange("saveHistory", checked)}
                  />
                  <GeneralToggleRow
                    bordered
                    title={t("ai_general_stream_title")}
                    description={t("ai_general_stream_description")}
                    checked={chatDraft.general.streamResponses}
                    onChange={(checked) => handleGeneralChange("streamResponses", checked)}
                  />
                  <GeneralToggleRow
                    bordered
                    title={t("ai_general_updates_title")}
                    description={t("ai_general_updates_description")}
                    checked={chatDraft.general.checkForUpdates}
                    onChange={(checked) => handleGeneralChange("checkForUpdates", checked)}
                  />
                </section>

                <section className="rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
                  <h4 className="text-[13px] font-medium text-[var(--app-text)]">
                    {t("ai_general_data_dir_title")}
                  </h4>
                  <p className="mt-0.5 text-xs text-[var(--app-text-muted)]">
                    {t("ai_general_data_dir_description")}
                  </p>
                  <div className="mt-3 rounded-md border border-[color:var(--app-border)] bg-[var(--app-bg)] px-2.5 py-2 font-mono text-[11px] text-[var(--app-text-muted)]">
                    {dataDirectory}
                  </div>
                </section>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SidebarButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 text-left text-[13px] transition-colors ${
        active
          ? "border-r-2 border-[var(--app-text)] bg-[var(--app-surface)] font-medium text-[var(--app-text)]"
          : "text-[var(--app-text-muted)] hover:bg-[var(--app-surface)] hover:text-[var(--app-text)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
    </button>
  );
}

function ProviderCardShell({
  badge,
  badgeClass,
  title,
  subtitle,
  status,
  children,
}: {
  badge: string;
  badgeClass: string;
  title: string;
  subtitle: string;
  status: ProviderStatus;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-[color:var(--app-border)] bg-[var(--app-surface)] px-4 py-4">
      <div className="flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-medium ${badgeClass}`}
            >
              {badge}
            </div>
            <div className="min-w-0">
              <h4 className="truncate text-[13px] font-medium text-[var(--app-text)]">
                {title}
              </h4>
              <p className="truncate text-[11px] text-[var(--app-text-muted)]">
                {subtitle}
              </p>
            </div>
          </div>

          <StatusIndicator status={status} />
        </div>

        {children}

        {status.detail ? (
          <p className="text-[11px] leading-4 text-[var(--app-text-muted)]">{status.detail}</p>
        ) : null}
      </div>
    </section>
  );
}

function ProviderActions({
  canRemove,
  onTest,
  onSave,
  onRemove,
}: {
  canRemove: boolean;
  onTest: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2 xl:justify-end">
      <button type="button" onClick={onTest} className={`${SECONDARY_BUTTON_CLASS} min-w-20`}>
        {t("ai_test")}
      </button>
      <button type="button" onClick={onSave} className={`${PRIMARY_BUTTON_CLASS} min-w-20`}>
        {t("ai_save")}
      </button>
      {canRemove ? (
        <button type="button" onClick={onRemove} className={DANGER_BUTTON_CLASS}>
          {t("ai_remove")}
        </button>
      ) : null}
    </div>
  );
}

function SecretInput({
  value,
  showValue,
  hasStoredKey,
  placeholder,
  onChange,
  onToggleShow,
}: {
  value: string;
  showValue: boolean;
  hasStoredKey: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onToggleShow: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex min-w-0 flex-1 gap-2">
      <input
        type={showValue ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={value || !hasStoredKey ? placeholder : "****************"}
        className={`${INPUT_CLASS} min-w-0 flex-1 font-mono`}
      />
      <button
        type="button"
        onClick={onToggleShow}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[color:var(--app-border)] bg-[var(--app-bg)] text-[var(--app-text-muted)] transition-colors hover:bg-[var(--app-surface-alt)] hover:text-[var(--app-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/25"
        aria-label={showValue ? t("ai_hide") : t("ai_show")}
      >
        <EyeIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function GeneralToggleRow({
  title,
  description,
  checked,
  onChange,
  bordered = false,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  bordered?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 py-3 ${
        bordered ? "border-t border-[color:var(--app-border)]" : ""
      }`}
    >
      <div className="min-w-0">
        <h4 className="text-[13px] font-medium text-[var(--app-text)]">{title}</h4>
        <p className="mt-0.5 text-[11px] text-[var(--app-text-muted)]">{description}</p>
      </div>
      <Toggle checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[18px] w-8 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/25 ${
        checked ? "bg-emerald-500" : "bg-[var(--app-border)]"
      }`}
    >
      <span
        className={`absolute top-[2.5px] h-[13px] w-[13px] rounded-full bg-white transition-transform ${
          checked ? "translate-x-[14px]" : "translate-x-[2.5px]"
        }`}
      />
    </button>
  );
}

function CapabilityToggle({
  title,
  enabled,
  onChange,
  icon: Icon,
}: {
  title: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  icon: (props: SVGProps<SVGSVGElement>) => ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={title}
      aria-pressed={enabled}
      title={title}
      onClick={() => onChange(!enabled)}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[var(--app-text-muted)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/25 ${
        enabled
          ? "border-sky-400/35 bg-sky-500/12 text-sky-100"
          : "border-[color:var(--app-border)] bg-[var(--app-bg)] hover:bg-[var(--app-surface-alt)]"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function StatusIndicator({ status }: { status: ProviderStatus }) {
  const { t } = useTranslation();
  const dotClasses: Record<StatusTone, string> = {
    neutral: "bg-[var(--app-text-muted)]/50",
    success: "bg-emerald-400",
    danger: "bg-red-400",
    info: "bg-sky-400",
  };
  const textClasses: Record<StatusTone, string> = {
    neutral: "text-[var(--app-text-muted)]",
    success: "text-emerald-100",
    danger: "text-red-100",
    info: "text-sky-100",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 text-[11px] ${textClasses[status.tone]}`}>
      <span className={`h-[7px] w-[7px] rounded-full ${dotClasses[status.tone]}`} />
      <span className="font-medium">{t(status.labelKey)}</span>
    </div>
  );
}

function buildProviderOptions(
  t: ReturnType<typeof useTranslation>["t"],
  customProviderName: string
): { id: ChatProvider; label: string }[] {
  return [
    { id: "anthropic", label: "Anthropic" },
    { id: "openai", label: "OpenAI" },
    { id: "gemini", label: "Google Gemini" },
    { id: "lmStudio", label: "LM Studio" },
    {
      id: "openAiCompatible",
      label: customProviderName || t("ai_provider_openai_compatible_title"),
    },
  ];
}

function getProviderLabel(provider: ChatProvider, customProviderName: string): string {
  if (provider === "anthropic") return "Anthropic";
  if (provider === "openai") return "OpenAI";
  if (provider === "gemini") return "Google Gemini";
  if (provider === "lmStudio") return "LM Studio";
  return customProviderName || "OpenAI-Compatible";
}

function createSecretProviderState(hasStoredKey: boolean): SecretProviderState {
  return {
    apiKeyDraft: "",
    showDraft: false,
    hasStoredKey,
    status: hasStoredKey ? STATUS_NOT_TESTED : STATUS_NOT_CONFIGURED,
  };
}

function createEndpointProviderState(
  displayName: string,
  endpointUrl: string,
  hasStoredKey: boolean
): EndpointProviderState {
  return {
    displayName,
    endpointUrl,
    ...createSecretProviderState(hasStoredKey),
  };
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

function syncChatSettings(chat: ChatSettings): ChatSettings {
  const cloned = cloneChatSettings(chat);
  const models = cloned.models.map((entry) => ({
    ...entry,
    id: entry.id.trim(),
    name: entry.name.trim(),
    modelId: entry.modelId.trim(),
  }));

  return {
    ...cloned,
    models,
    openai: {
      model: resolvePrimaryModelId(models, "openai", cloned.openai.model),
    },
    anthropic: {
      model: resolvePrimaryModelId(models, "anthropic", cloned.anthropic.model),
    },
    gemini: {
      model: resolvePrimaryModelId(models, "gemini", cloned.gemini.model),
    },
    lmStudio: {
      ...cloned.lmStudio,
      model: resolvePrimaryModelId(models, "lmStudio", cloned.lmStudio.model),
    },
    openAiCompatible: {
      ...cloned.openAiCompatible,
      model: resolvePrimaryModelId(
        models,
        "openAiCompatible",
        cloned.openAiCompatible.model
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

  if (enabledMatch?.modelId) {
    return enabledMatch.modelId;
  }

  const firstMatch = models.find((entry) => entry.provider === provider && entry.modelId);
  return firstMatch?.modelId || fallback;
}

function getPrimaryModelEntryId(
  models: ChatModelCatalogEntry[],
  provider: ChatProvider
): string | null {
  const enabledMatch = models.find(
    (entry) => entry.provider === provider && entry.enabled
  );

  if (enabledMatch) {
    return enabledMatch.id;
  }

  const firstMatch = models.find((entry) => entry.provider === provider);
  return firstMatch?.id ?? null;
}

function ProvidersIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </svg>
  );
}

function ModelsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <circle cx="8" cy="8" r="5" />
      <path d="M8 5v3l2 1" />
    </svg>
  );
}

function GeneralIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <circle cx="8" cy="8" r="2" />
      <path d="M8 2v2M8 12v2M2 8h2M12 8h2M4.2 4.2l1.4 1.4M10.4 10.4l1.4 1.4M4.2 11.8l1.4-1.4M10.4 5.6l1.4-1.4" />
    </svg>
  );
}

function EyeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M1.5 8s2.3-4 6.5-4 6.5 4 6.5 4-2.3 4-6.5 4-6.5-4-6.5-4Z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function ToolIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M9.7 2.3a3.4 3.4 0 0 0 3.6 4.9l-4.4 4.4a2.1 2.1 0 0 1-3 0L3 13.7a1.2 1.2 0 0 1 0-1.7l2.8-2.8a2.1 2.1 0 0 1 0-3l4.4-4.4a3.4 3.4 0 0 0-.5 3.6Z" />
      <path d="M11.8 4.2l.9-.9" />
    </svg>
  );
}

function ThinkIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" {...props}>
      <path d="M6.2 13.2h3.6" />
      <path d="M6.7 15h2.6" />
      <path d="M5.2 6.8a3.1 3.1 0 1 1 5.6 1.9c-.6.8-1.2 1.2-1.5 2.3H6.7c-.3-1.1-.9-1.5-1.5-2.3a3.1 3.1 0 0 1 0-1.9Z" />
    </svg>
  );
}
