use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessageInput {
    pub role: String,
    pub content: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatCompletionResult {
    pub content: String,
    pub thinking_content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiMessage {
    role: String,
    content: Value,
}

#[derive(Debug, Serialize)]
struct ChatCompletionRequest {
    model: String,
    messages: Vec<ApiMessage>,
    temperature: f64,
}

#[derive(Debug, Deserialize)]
struct ChatCompletionResponse {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatResponseMessage,
}

#[derive(Debug, Deserialize)]
struct ChatResponseMessage {
    content: Option<String>,
    // Some models (e.g. DeepSeek) return reasoning in a dedicated field.
    thinking_content: Option<String>,
}

#[tauri::command]
pub async fn send_chat_message(
    endpoint_url: &str,
    api_key: Option<String>,
    model: &str,
    messages: Vec<ChatMessageInput>,
    temperature: Option<f64>,
) -> Result<ChatCompletionResult, String> {
    let base = endpoint_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Endpoint URL is required.".to_string());
    }

    let url = format!("{}/v1/chat/completions", base);
    let temp = temperature.unwrap_or(0.7);

    let api_messages: Vec<ApiMessage> = messages
        .into_iter()
        .map(|m| ApiMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let body = ChatCompletionRequest {
        model: model.to_string(),
        messages: api_messages,
        temperature: temp,
    };

    let client = Client::new();
    let mut request = client.post(&url).json(&body);

    if let Some(key) = &api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            request = request.bearer_auth(trimmed);
        }
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request to {} failed: {}", url, e))?;

    let status = response.status();
    if !status.is_success() {
        let error_body = response.text().await.unwrap_or_default();
        return Err(format!(
            "API returned HTTP {} — {}",
            status.as_u16(),
            error_body
        ));
    }

    let parsed: ChatCompletionResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse API response: {}", e))?;

    let choice = parsed
        .choices
        .into_iter()
        .next()
        .ok_or_else(|| "API returned no choices.".to_string())?;

    Ok(ChatCompletionResult {
        content: choice.message.content.unwrap_or_default(),
        thinking_content: choice.message.thinking_content,
    })
}
