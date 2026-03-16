use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::ipc::Channel;

// ── Shared input/output types ────────────────────────────────────────────────

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

// ── Streaming event sent to the frontend via Channel ────────────────────────

#[derive(Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum StreamEvent {
    /// A text delta from the assistant.
    Chunk { content: String },
    /// A reasoning/thinking delta (e.g. DeepSeek).
    Thinking { content: String },
    /// Stream finished cleanly.
    End,
    /// Stream ended with an error.
    Error { message: String },
}

// ── Internal request/response types ─────────────────────────────────────────

#[derive(Debug, Serialize)]
struct ApiMessage {
    role: String,
    content: Value,
}

// SSE delta shapes (OpenAI-compatible)
#[derive(Debug, Deserialize)]
struct SseDelta {
    content: Option<String>,
    /// DeepSeek and some other models return reasoning here.
    reasoning_content: Option<String>,
    thinking_content: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SseChoice {
    delta: SseDelta,
}

#[derive(Debug, Deserialize)]
struct SseEvent {
    choices: Vec<SseChoice>,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn build_client_request(
    endpoint_url: &str,
    api_key: &Option<String>,
    model: &str,
    messages: Vec<ChatMessageInput>,
    temperature: f64,
    stream: bool,
) -> Result<reqwest::RequestBuilder, String> {
    let base = endpoint_url.trim().trim_end_matches('/');
    if base.is_empty() {
        return Err("Endpoint URL is required.".to_string());
    }

    let url = format!("{}/v1/chat/completions", base);

    let api_messages: Vec<ApiMessage> = messages
        .into_iter()
        .map(|m| ApiMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let body = serde_json::json!({
        "model": model,
        "messages": api_messages,
        "temperature": temperature,
        "stream": stream,
    });

    let client = Client::new();
    let mut req = client.post(&url).json(&body);

    if let Some(key) = api_key {
        let trimmed = key.trim();
        if !trimmed.is_empty() {
            req = req.bearer_auth(trimmed);
        }
    }

    Ok(req)
}

// ── Non-streaming command (kept as fallback) ─────────────────────────────────

#[tauri::command]
pub async fn send_chat_message(
    endpoint_url: &str,
    api_key: Option<String>,
    model: &str,
    messages: Vec<ChatMessageInput>,
    temperature: Option<f64>,
) -> Result<ChatCompletionResult, String> {
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
        thinking_content: Option<String>,
    }

    let req = build_client_request(
        endpoint_url,
        &api_key,
        model,
        messages,
        temperature.unwrap_or(0.7),
        false,
    )?;

    let response = req
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API returned HTTP {} — {}", status.as_u16(), body));
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

// ── Streaming command ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn stream_chat_message(
    endpoint_url: &str,
    api_key: Option<String>,
    model: &str,
    messages: Vec<ChatMessageInput>,
    temperature: Option<f64>,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    let req = build_client_request(
        endpoint_url,
        &api_key,
        model,
        messages,
        temperature.unwrap_or(0.7),
        true,
    )?;

    let response = req
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API returned HTTP {} — {}", status.as_u16(), body));
    }

    // Stream response body — buffer bytes into lines and parse SSE
    let mut response = response;
    let mut buf: Vec<u8> = Vec::new();

    loop {
        match response.chunk().await {
            Ok(Some(chunk)) => {
                buf.extend_from_slice(&chunk);

                // Extract and process every complete line in the buffer
                loop {
                    match buf.iter().position(|&b| b == b'\n') {
                        Some(pos) => {
                            let line_bytes = buf[..pos].to_vec();
                            buf.drain(..=pos);

                            let line = String::from_utf8_lossy(&line_bytes);
                            let line = line.trim_end_matches('\r').trim();

                            if let Some(data) = line.strip_prefix("data: ") {
                                if data == "[DONE]" {
                                    let _ = on_event.send(StreamEvent::End);
                                    return Ok(());
                                }

                                if let Ok(event) = serde_json::from_str::<SseEvent>(data) {
                                    if let Some(choice) = event.choices.first() {
                                        let delta = &choice.delta;

                                        if let Some(content) = &delta.content {
                                            if !content.is_empty() {
                                                let _ = on_event.send(StreamEvent::Chunk {
                                                    content: content.clone(),
                                                });
                                            }
                                        }

                                        let thinking = delta
                                            .reasoning_content
                                            .as_ref()
                                            .or(delta.thinking_content.as_ref());

                                        if let Some(tc) = thinking {
                                            if !tc.is_empty() {
                                                let _ = on_event.send(StreamEvent::Thinking {
                                                    content: tc.clone(),
                                                });
                                            }
                                        }
                                    }
                                }
                            }
                        }
                        None => break,
                    }
                }
            }
            Ok(None) => {
                // Stream ended without [DONE] — some providers omit it
                let _ = on_event.send(StreamEvent::End);
                break;
            }
            Err(e) => {
                let msg = e.to_string();
                let _ = on_event.send(StreamEvent::Error { message: msg.clone() });
                return Err(msg);
            }
        }
    }

    Ok(())
}
