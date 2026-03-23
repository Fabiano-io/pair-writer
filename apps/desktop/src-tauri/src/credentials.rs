use reqwest::StatusCode;
use serde::Serialize;
use std::env;

#[cfg(windows)]
use std::io::ErrorKind;
#[cfg(windows)]
use winreg::{enums::HKEY_CURRENT_USER, RegKey};

const OPENAI_API_BASE: &str = "https://api.openai.com/v1";
const ANTHROPIC_API_BASE: &str = "https://api.anthropic.com/v1";
const GEMINI_OPENAI_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/openai";
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Clone, Copy)]
struct CredentialConfig {
    env_var: &'static str,
    provider_label: &'static str,
}

fn credential_config(service: &str) -> Result<CredentialConfig, String> {
    match service.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok(CredentialConfig {
            env_var: "OPENAI_API_KEY",
            provider_label: "OpenAI",
        }),
        "anthropic" => Ok(CredentialConfig {
            env_var: "ANTHROPIC_API_KEY",
            provider_label: "Anthropic",
        }),
        "gemini" => Ok(CredentialConfig {
            env_var: "GEMINI_API_KEY",
            provider_label: "Gemini",
        }),
        "lmstudio" | "lm_studio" => Ok(CredentialConfig {
            env_var: "LM_STUDIO_API_KEY",
            provider_label: "LM Studio",
        }),
        "openaicompatible" | "open_ai_compatible" | "openai-compatible" => {
            Ok(CredentialConfig {
                env_var: "OPENAI_COMPATIBLE_API_KEY",
                provider_label: "OpenAI-compatible endpoint",
            })
        }
        other => Err(format!("Unsupported credential service: {}", other)),
    }
}

fn normalize_key(key: &str) -> String {
    key.trim().to_string()
}

fn read_process_env_var(env_var: &str) -> Option<String> {
    match env::var(env_var) {
        Ok(value) => {
            let normalized = normalize_key(&value);
            if normalized.is_empty() {
                None
            } else {
                Some(normalized)
            }
        }
        Err(_) => None,
    }
}

#[cfg(windows)]
fn read_persisted_env_var(env_var: &str) -> Result<Option<String>, String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let environment = hkcu
        .open_subkey("Environment")
        .map_err(|e| format!("Failed to open user environment variables: {}", e))?;

    match environment.get_value::<String, _>(env_var) {
        Ok(value) => {
            let normalized = normalize_key(&value);
            if normalized.is_empty() {
                Ok(None)
            } else {
                Ok(Some(normalized))
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Failed to read user environment variable {}: {}",
            env_var, error
        )),
    }
}

#[cfg(not(windows))]
fn read_persisted_env_var(_env_var: &str) -> Result<Option<String>, String> {
    Ok(None)
}

fn load_api_key(service: &str) -> Result<Option<String>, String> {
    let config = credential_config(service)?;

    if let Some(value) = read_process_env_var(config.env_var) {
        return Ok(Some(value));
    }

    if let Some(value) = read_persisted_env_var(config.env_var)? {
        env::set_var(config.env_var, &value);
        return Ok(Some(value));
    }

    Ok(None)
}

#[cfg(windows)]
fn persist_env_var(env_var: &str, value: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let (environment, _) = hkcu
        .create_subkey("Environment")
        .map_err(|e| format!("Failed to open user environment variables: {}", e))?;

    environment
        .set_value(env_var, &value)
        .map_err(|e| format!("Failed to store {}: {}", env_var, e))
}

#[cfg(not(windows))]
fn persist_env_var(_env_var: &str, _value: &str) -> Result<(), String> {
    Ok(())
}

#[cfg(windows)]
fn delete_persisted_env_var(env_var: &str) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let environment = hkcu
        .open_subkey_with_flags("Environment", winreg::enums::KEY_SET_VALUE)
        .map_err(|e| format!("Failed to open user environment variables: {}", e))?;

    match environment.delete_value(env_var) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!("Failed to remove {}: {}", env_var, error)),
    }
}

#[cfg(not(windows))]
fn delete_persisted_env_var(_env_var: &str) -> Result<(), String> {
    Ok(())
}

fn missing_provider_result(config: CredentialConfig) -> ProviderTestResult {
    ProviderTestResult {
        ok: false,
        status: "missing".to_string(),
        message: format!(
            "Configure {} in {} first.",
            config.provider_label, config.env_var
        ),
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTestResult {
    pub ok: bool,
    pub status: String,
    pub message: String,
}

#[tauri::command]
pub fn save_api_key(service: &str, key: &str) -> Result<(), String> {
    let config = credential_config(service)?;
    let normalized_key = normalize_key(key);

    if normalized_key.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }

    persist_env_var(config.env_var, &normalized_key)?;
    env::set_var(config.env_var, normalized_key);

    Ok(())
}

#[tauri::command]
pub fn get_api_key(service: &str) -> Result<String, String> {
    let config = credential_config(service)?;

    load_api_key(service)?.ok_or_else(|| {
        format!(
            "No API key is currently configured for {} in {}.",
            config.provider_label, config.env_var
        )
    })
}

#[tauri::command]
pub fn has_api_key(service: &str) -> Result<bool, String> {
    Ok(load_api_key(service)?.is_some())
}

#[tauri::command]
pub fn delete_api_key(service: &str) -> Result<(), String> {
    let config = credential_config(service)?;

    delete_persisted_env_var(config.env_var)?;
    env::remove_var(config.env_var);

    Ok(())
}

#[tauri::command]
pub async fn test_provider_connection(
    service: &str,
    model: Option<String>,
    endpoint_url: Option<String>,
) -> Result<ProviderTestResult, String> {
    let normalized_service = service.trim().to_ascii_lowercase();

    match normalized_service.as_str() {
        "openai" => {
            let config = credential_config("openai")?;
            let Some(key) = load_api_key("openai")? else {
                return Ok(missing_provider_result(config));
            };

            test_openai_connection(&key, model).await
        }
        "anthropic" => {
            let config = credential_config("anthropic")?;
            let Some(key) = load_api_key("anthropic")? else {
                return Ok(missing_provider_result(config));
            };

            test_anthropic_connection(&key, model).await
        }
        "gemini" => {
            let config = credential_config("gemini")?;
            let Some(key) = load_api_key("gemini")? else {
                return Ok(missing_provider_result(config));
            };

            test_gemini_connection(&key, model).await
        }
        "lmstudio" | "lm_studio" => {
            let endpoint = endpoint_url
                .unwrap_or_default()
                .trim()
                .trim_end_matches('/')
                .to_string();
            let key = load_api_key("lmstudio")?;
            test_openai_compatible_connection("LM Studio", &endpoint, model, key.as_deref()).await
        }
        "openaicompatible" | "open_ai_compatible" | "openai-compatible" => {
            let endpoint = endpoint_url
                .unwrap_or_default()
                .trim()
                .trim_end_matches('/')
                .to_string();
            let key = load_api_key("openai-compatible")?;
            test_openai_compatible_connection(
                "OpenAI-compatible endpoint",
                &endpoint,
                model,
                key.as_deref(),
            )
            .await
        }
        _ => Err(format!("Unsupported provider for connection test: {}", service)),
    }
}

async fn test_openai_connection(
    key: &str,
    model: Option<String>,
) -> Result<ProviderTestResult, String> {
    let client = reqwest::Client::new();
    let model_id = model.unwrap_or_else(|| "gpt-4.1".to_string()).trim().to_string();

    let response = client
        .get(format!("{}/models/{}", OPENAI_API_BASE, model_id))
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| format!("OpenAI request failed: {}", e))?;

    Ok(provider_result_from_response(
        response.status(),
        "OpenAI",
        Some(&model_id),
    ))
}

async fn test_anthropic_connection(
    key: &str,
    model: Option<String>,
) -> Result<ProviderTestResult, String> {
    let client = reqwest::Client::new();
    let model_id = model
        .unwrap_or_else(|| "claude-sonnet-4-5".to_string())
        .trim()
        .to_string();

    let response = client
        .get(format!("{}/models/{}", ANTHROPIC_API_BASE, model_id))
        .header("x-api-key", key)
        .header("anthropic-version", ANTHROPIC_VERSION)
        .send()
        .await
        .map_err(|e| format!("Anthropic request failed: {}", e))?;

    Ok(provider_result_from_response(
        response.status(),
        "Anthropic",
        Some(&model_id),
    ))
}

async fn test_gemini_connection(
    key: &str,
    model: Option<String>,
) -> Result<ProviderTestResult, String> {
    let client = reqwest::Client::new();
    let model_id = model
        .unwrap_or_else(|| "gemini-2.5-pro".to_string())
        .trim()
        .to_string();

    let response = client
        .get(format!("{}/models/{}", GEMINI_OPENAI_BASE, model_id))
        .bearer_auth(key)
        .send()
        .await
        .map_err(|e| format!("Gemini request failed: {}", e))?;

    Ok(provider_result_from_response(
        response.status(),
        "Gemini",
        Some(&model_id),
    ))
}

async fn test_openai_compatible_connection(
    provider_label: &str,
    endpoint: &str,
    model: Option<String>,
    api_key: Option<&str>,
) -> Result<ProviderTestResult, String> {
    if endpoint.is_empty() {
        return Ok(ProviderTestResult {
            ok: false,
            status: "missing".to_string(),
            message: format!("Configure the {} endpoint first.", provider_label),
        });
    }

    let client = reqwest::Client::new();
    let request = client.get(format!("{}/v1/models", endpoint));
    let request = match api_key {
        Some(value) if !value.trim().is_empty() => request.bearer_auth(value),
        _ => request,
    };
    let response = request
        .send()
        .await
        .map_err(|e| format!("{} request failed: {}", provider_label, e))?;

    if response.status().is_success() {
        let detail = match model {
            Some(model_id) if !model_id.trim().is_empty() => {
                format!(
                    "{} is reachable at {} and ready for {}.",
                    provider_label,
                    endpoint,
                    model_id.trim()
                )
            }
            _ => format!("{} is reachable at {}.", provider_label, endpoint),
        };

        return Ok(ProviderTestResult {
            ok: true,
            status: "valid".to_string(),
            message: detail,
        });
    }

    Ok(provider_result_from_response(
        response.status(),
        provider_label,
        model.as_deref(),
    ))
}

fn provider_result_from_response(
    status: StatusCode,
    provider_label: &str,
    model: Option<&str>,
) -> ProviderTestResult {
    if status.is_success() {
        let model_suffix = model
            .filter(|value| !value.trim().is_empty())
            .map(|value| format!(" for {}.", value.trim()))
            .unwrap_or_else(|| ".".to_string());

        return ProviderTestResult {
            ok: true,
            status: "valid".to_string(),
            message: format!("{} credentials validated{}", provider_label, model_suffix),
        };
    }

    let message = match status {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
            format!("{} rejected the saved credentials.", provider_label)
        }
        StatusCode::NOT_FOUND => {
            let model_label = model
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("the selected model");
            format!("{} could not find {}.", provider_label, model_label)
        }
        _ => format!("{} returned HTTP {}.", provider_label, status.as_u16()),
    };

    ProviderTestResult {
        ok: false,
        status: "invalid".to_string(),
        message,
    }
}
