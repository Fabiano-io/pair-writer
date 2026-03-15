import type {
  ChatProvider,
  ChatSettings,
  ProviderModelSettings,
} from "../settings/settingsDefaults";
import { loadSettings, saveSettings } from "../settings/appSettings";

export async function loadChatSettings(): Promise<ChatSettings> {
  const settings = await loadSettings();
  return settings.chat!;
}

export async function saveChatSettings(chat: ChatSettings): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    chat,
  });
}

export async function saveChatProvider(provider: ChatProvider): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    chat: {
      ...settings.chat!,
      provider,
    },
  });
}

export async function saveProviderModel(
  provider: Exclude<ChatProvider, "lmStudio">,
  model: string
): Promise<void> {
  const normalizedModel = model.trim();
  if (!normalizedModel) return;

  const settings = await loadSettings();
  const currentChat = settings.chat!;
  const nextProviderSettings: ProviderModelSettings = {
    ...currentChat[provider],
    model: normalizedModel,
  };

  await saveSettings({
    ...settings,
    chat: {
      ...currentChat,
      [provider]: nextProviderSettings,
    },
  });
}

export async function saveLmStudioConfig(
  endpointUrl: string
): Promise<void> {
  const normalizedEndpointUrl = endpointUrl.trim();
  if (!normalizedEndpointUrl) return;

  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    chat: {
      ...settings.chat!,
      lmStudio: {
        endpointUrl: normalizedEndpointUrl,
        model: settings.chat!.lmStudio.model,
      },
    },
  });
}

export async function saveOpenAiCompatibleConfig(
  displayName: string,
  endpointUrl: string
): Promise<void> {
  const normalizedName = displayName.trim();
  const normalizedEndpointUrl = endpointUrl.trim();
  if (!normalizedName || !normalizedEndpointUrl) return;

  const settings = await loadSettings();
  await saveSettings({
    ...settings,
    chat: {
      ...settings.chat!,
      openAiCompatible: {
        displayName: normalizedName,
        endpointUrl: normalizedEndpointUrl,
        model: settings.chat!.openAiCompatible.model,
      },
    },
  });
}
