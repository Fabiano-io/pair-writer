import { invoke } from "@tauri-apps/api/core";
import type { ChatProvider } from "../settings/settingsDefaults";

export type ApiCredentialService =
  | "openai"
  | "anthropic"
  | "gemini"
  | "lmStudio"
  | "openAiCompatible";
export type TestableProvider = ChatProvider | "lmStudio" | "openAiCompatible";

export interface ProviderTestResult {
  ok: boolean;
  status: "valid" | "invalid" | "missing";
  message: string;
}

export async function saveApiKey(
  service: ApiCredentialService,
  key: string
): Promise<void> {
  await invoke("save_api_key", { service, key });
}

export async function getApiKey(
  service: ApiCredentialService
): Promise<string> {
  return invoke<string>("get_api_key", { service });
}

export async function hasApiKey(
  service: ApiCredentialService
): Promise<boolean> {
  return invoke<boolean>("has_api_key", { service });
}

export async function deleteApiKey(
  service: ApiCredentialService
): Promise<void> {
  await invoke("delete_api_key", { service });
}

export async function testProviderConnection(
  service: TestableProvider,
  options?: {
    model?: string;
    endpointUrl?: string;
  }
): Promise<ProviderTestResult> {
  return invoke<ProviderTestResult>("test_provider_connection", {
    service,
    model: options?.model,
    endpointUrl: options?.endpointUrl,
  });
}
