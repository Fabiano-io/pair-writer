use keyring::Entry;
use reqwest::StatusCode;
use serde::Serialize;

const APP_KEYRING_SERVICE: &str = "pair-writer";
const OPENAI_API_BASE: &str = "https://api.openai.com/v1";
const ANTHROPIC_API_BASE: &str = "https://api.anthropic.com/v1";
const GEMINI_OPENAI_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/openai";
const ANTHROPIC_VERSION: &str = "2023-06-01";

fn normalize_service(service: &str) -> Result<&'static str, String> {
    match service.trim().to_ascii_lowercase().as_str() {
        "openai" => Ok("openai_api_key"),
        "anthropic" => Ok("anthropic_api_key"),
        "gemini" => Ok("gemini_api_key"),
        "lmstudio" | "lm_studio" => Ok("lm_studio_api_key"),
        "openaicompatible" | "open_ai_compatible" | "openai-compatible" => {
            Ok("openai_compatible_api_key")
        }
        other => Err(format!("Unsupported credential service: {}", other)),
    }
}

fn credential_entry(service: &str) -> Result<Entry, String> {
    let account = normalize_service(service)?;
    Entry::new(APP_KEYRING_SERVICE, account).map_err(|e| e.to_string())
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
    let normalized_key = key.trim();
    if normalized_key.is_empty() {
        return Err("API key cannot be empty.".to_string());
    }

    credential_entry(service)?
        .set_password(normalized_key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(service: &str) -> Result<String, String> {
    credential_entry(service)?
        .get_password()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn has_api_key(service: &str) -> Result<bool, String> {
    match credential_entry(service)?.get_password() {
        Ok(value) => Ok(!value.trim().is_empty()),
        Err(_) => Ok(false),
    }
}

#[tauri::command]
pub fn delete_api_key(service: &str) -> Result<(), String> {
    credential_entry(service)?
        .delete_password()
        .map_err(|e| e.to_string())
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
            let key = get_api_key("openai")?;
            test_openai_connection(&key, model).await
        }
        "anthropic" => {
            let key = get_api_key("anthropic")?;
            test_anthropic_connection(&key, model).await
        }
        "gemini" => {
            let key = get_api_key("gemini")?;
            test_gemini_connection(&key, model).await
        }
        "lmstudio" | "lm_studio" => {
            let endpoint = endpoint_url
                .unwrap_or_default()
                .trim()
                .trim_end_matches('/')
                .to_string();
            let key = get_api_key("lmstudio").ok();
            test_openai_compatible_connection("LM Studio", &endpoint, model, key.as_deref()).await
        }
        "openaicompatible" | "open_ai_compatible" | "openai-compatible" => {
            let endpoint = endpoint_url
                .unwrap_or_default()
                .trim()
                .trim_end_matches('/')
                .to_string();
            let key = get_api_key("openai-compatible").ok();
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
    let model_id = model
        .unwrap_or_else(|| "gpt-5.2".to_string())
        .trim()
        .to_string();

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
        .unwrap_or_else(|| "claude-sonnet-4-20250514".to_string())
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
                format!("{} is reachable at {} and ready for {}.", provider_label, endpoint, model_id.trim())
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
