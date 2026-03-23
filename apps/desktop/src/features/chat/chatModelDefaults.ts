import type {
  ChatModelCatalogEntry,
  ChatProvider,
} from "../settings/settingsDefaults";

export function getEnabledModelById(
  models: ChatModelCatalogEntry[],
  modelId: string | null | undefined
): ChatModelCatalogEntry | null {
  const normalizedId = normalizeModelId(modelId);
  if (!normalizedId) return null;

  return (
    models.find((entry) => entry.id === normalizedId && entry.enabled) ?? null
  );
}

export function getFirstEnabledModel(
  models: ChatModelCatalogEntry[]
): ChatModelCatalogEntry | null {
  return models.find((entry) => entry.enabled) ?? null;
}

export function getProviderPrimaryModelId(
  models: ChatModelCatalogEntry[],
  provider: ChatProvider
): string | null {
  const enabledMatch = models.find(
    (entry) => entry.provider === provider && entry.enabled
  );

  if (enabledMatch?.id) {
    return enabledMatch.id;
  }

  const firstMatch = models.find((entry) => entry.provider === provider);
  return firstMatch?.id ?? null;
}

export function resolvePreferredEnabledModelId(
  models: ChatModelCatalogEntry[],
  preferredId: string | null | undefined,
  fallbackId?: string | null
): string | null {
  const preferred = getEnabledModelById(models, preferredId);
  if (preferred) {
    return preferred.id;
  }

  const fallback = getEnabledModelById(models, fallbackId);
  if (fallback) {
    return fallback.id;
  }

  return getFirstEnabledModel(models)?.id ?? models[0]?.id ?? null;
}

export function resolveDefaultChatModelId(
  models: ChatModelCatalogEntry[],
  provider: ChatProvider,
  preferredId: string | null | undefined
): string | null {
  return resolvePreferredEnabledModelId(
    models,
    preferredId,
    getProviderPrimaryModelId(models, provider)
  );
}

export function resolveDefaultBubbleModelId(
  models: ChatModelCatalogEntry[],
  provider: ChatProvider,
  defaultChatModelId: string | null | undefined,
  preferredId: string | null | undefined
): string | null {
  return resolvePreferredEnabledModelId(
    models,
    preferredId,
    resolveDefaultChatModelId(models, provider, defaultChatModelId)
  );
}

function normalizeModelId(modelId: string | null | undefined): string {
  return (modelId ?? "").trim();
}
