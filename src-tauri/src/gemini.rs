use crate::types::TranscriptionResponse;
use serde_json::{json, Value};
use std::path::Path;
use std::time::Duration;
use thiserror::Error;
use tokio::io::AsyncReadExt;

const BASE_URL: &str = "https://generativelanguage.googleapis.com";
const MODEL_ID: &str = "gemini-3.5-flash";
// Matches the chunk size used by Google's own @google/genai Node SDK.
const MAX_CHUNK_SIZE: u64 = 8 * 1024 * 1024;

const PROMPT: &str = r#"
You are an expert audio transcription assistant.
Process the provided audio file and generate a detailed transcription.

CRITICAL REQUIREMENT for Speaker Diarization:
- You MUST create a new segment EVERY SINGLE TIME the speaker changes.
- Even if a speaker interjects with a single word (e.g., "Yeah", "Uh-huh"), you must break the current segment, create a new segment for the interjection, and then create another new segment when the original speaker resumes.
- NEVER include words from two different speakers in the same segment. Be extremely precise with diarization.

Requirements:
1. Identify distinct speakers (e.g., Speaker 1, Speaker 2, or names if context allows).
2. Provide accurate timestamps for each segment (Format: MM:SS - MM:SS).
3. Detect the primary language of each segment.
4. If the segment is in a language different than English, also provide the English translation.
5. Identify the primary emotion of the speaker in this segment. You MUST choose exactly one of the following: Happy, Sad, Angry, Neutral.
6. Provide a brief summary of the entire audio at the beginning.

Output Format: JSON object with the following structure:
{
  "summary": "A brief summary of the conversation...",
  "segments": [
    {
      "speaker": "Speaker 1",
      "timestamp": "00:00 - 00:15",
      "content": "Hello, how are you doing today?",
      "language": "English",
      "language_code": "en",
      "translation": "",
      "emotion": "Happy"
    }
  ]
}
"#;

#[derive(Debug, Error)]
pub enum GeminiError {
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("gemini api error: {0}")]
    Api(String),
    #[error("failed to parse gemini response: {0}")]
    Parse(String),
}

impl From<GeminiError> for String {
    fn from(e: GeminiError) -> Self {
        e.to_string()
    }
}

pub async fn transcribe(
    api_key: &str,
    file_path: &Path,
    mime_type: &str,
) -> Result<TranscriptionResponse, GeminiError> {
    let client = reqwest::Client::new();
    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("upload");
    let file_size = tokio::fs::metadata(file_path).await?.len();

    let uploaded = upload_file(&client, api_key, file_path, file_name, mime_type, file_size).await?;

    let file_uri = uploaded["uri"]
        .as_str()
        .ok_or_else(|| GeminiError::Parse("missing file uri in upload response".into()))?
        .to_string();
    let file_resource_name = uploaded["name"]
        .as_str()
        .ok_or_else(|| GeminiError::Parse("missing file name in upload response".into()))?
        .to_string();
    let file_mime = uploaded["mimeType"]
        .as_str()
        .unwrap_or(mime_type)
        .to_string();

    wait_for_active(&client, api_key, &file_resource_name).await?;

    generate_content(&client, api_key, &file_uri, &file_mime).await
}

async fn upload_file(
    client: &reqwest::Client,
    api_key: &str,
    file_path: &Path,
    file_name: &str,
    mime_type: &str,
    file_size: u64,
) -> Result<Value, GeminiError> {
    let start_resp = client
        .post(format!("{BASE_URL}/upload/v1beta/files"))
        .header("x-goog-api-key", api_key)
        .header("Content-Type", "application/json")
        .header("X-Goog-Upload-Protocol", "resumable")
        .header("X-Goog-Upload-Command", "start")
        .header("X-Goog-Upload-Header-Content-Length", file_size.to_string())
        .header("X-Goog-Upload-Header-Content-Type", mime_type)
        .json(&json!({
            "file": {
                "mimeType": mime_type,
                "sizeBytes": file_size.to_string(),
                "displayName": file_name,
            }
        }))
        .send()
        .await?;

    if !start_resp.status().is_success() {
        let status = start_resp.status();
        let body = start_resp.text().await.unwrap_or_default();
        return Err(GeminiError::Api(format!(
            "upload start failed ({status}): {body}"
        )));
    }

    let upload_url = start_resp
        .headers()
        .get("x-goog-upload-url")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| GeminiError::Parse("missing x-goog-upload-url header".into()))?
        .to_string();

    let mut file = tokio::fs::File::open(file_path).await?;
    let mut offset: u64 = 0;

    loop {
        let remaining = file_size - offset;
        let chunk_size = remaining.min(MAX_CHUNK_SIZE);
        let mut buf = vec![0u8; chunk_size as usize];
        file.read_exact(&mut buf).await?;

        let is_last = offset + chunk_size >= file_size;
        let command = if is_last { "upload, finalize" } else { "upload" };

        let resp = client
            .post(&upload_url)
            .header("X-Goog-Upload-Command", command)
            .header("X-Goog-Upload-Offset", offset.to_string())
            .header("Content-Length", chunk_size.to_string())
            .header("X-Goog-Upload-File-Name", file_name)
            .body(buf)
            .send()
            .await?;

        let status_header = resp
            .headers()
            .get("x-goog-upload-status")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string());

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(GeminiError::Api(format!(
                "upload chunk failed ({status}): {body}"
            )));
        }

        offset += chunk_size;

        match status_header.as_deref() {
            Some("final") => {
                let body: Value = resp.json().await?;
                return Ok(body["file"].clone());
            }
            Some("cancelled") => {
                return Err(GeminiError::Api("upload was cancelled by the server".into()));
            }
            _ => {
                if offset >= file_size {
                    return Err(GeminiError::Api(
                        "all bytes uploaded but server did not finalize".into(),
                    ));
                }
                // "active" — continue with the next chunk.
            }
        }
    }
}

async fn wait_for_active(
    client: &reqwest::Client,
    api_key: &str,
    file_resource_name: &str,
) -> Result<(), GeminiError> {
    loop {
        let resp = client
            .get(format!("{BASE_URL}/v1beta/{file_resource_name}"))
            .header("x-goog-api-key", api_key)
            .send()
            .await?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(GeminiError::Api(format!(
                "file status check failed ({status}): {body}"
            )));
        }

        let body: Value = resp.json().await?;
        let state = body["state"].as_str().unwrap_or("");

        match state {
            "ACTIVE" => return Ok(()),
            "FAILED" => {
                return Err(GeminiError::Api(
                    "Gemini failed to process the uploaded file".into(),
                ))
            }
            _ => tokio::time::sleep(Duration::from_secs(2)).await,
        }
    }
}

async fn generate_content(
    client: &reqwest::Client,
    api_key: &str,
    file_uri: &str,
    file_mime: &str,
) -> Result<TranscriptionResponse, GeminiError> {
    let schema = json!({
        "type": "OBJECT",
        "properties": {
            "summary": {
                "type": "STRING",
                "description": "A concise summary of the audio content."
            },
            "segments": {
                "type": "ARRAY",
                "description": "List of transcribed segments with speaker and timestamp.",
                "items": {
                    "type": "OBJECT",
                    "properties": {
                        "speaker": { "type": "STRING" },
                        "timestamp": { "type": "STRING" },
                        "content": { "type": "STRING" },
                        "language": { "type": "STRING" },
                        "language_code": { "type": "STRING" },
                        "translation": { "type": "STRING" },
                        "emotion": {
                            "type": "STRING",
                            "description": "The emotion of the speaker.",
                            "enum": ["Happy", "Sad", "Angry", "Neutral"]
                        }
                    },
                    "required": ["speaker", "timestamp", "content", "language", "language_code", "emotion"]
                }
            }
        },
        "required": ["summary", "segments"]
    });

    let body = json!({
        "contents": [
            {
                "role": "user",
                "parts": [
                    { "fileData": { "fileUri": file_uri, "mimeType": file_mime } },
                    { "text": PROMPT }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema
        }
    });

    let resp = client
        .post(format!("{BASE_URL}/v1beta/models/{MODEL_ID}:generateContent"))
        .header("x-goog-api-key", api_key)
        .json(&body)
        .send()
        .await?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(GeminiError::Api(format!(
            "generateContent failed ({status}): {body}"
        )));
    }

    let json_resp: Value = resp.json().await?;
    let text = json_resp["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| GeminiError::Parse("no text in generateContent response".into()))?;

    let cleaned = text
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim();

    serde_json::from_str::<TranscriptionResponse>(cleaned)
        .map_err(|e| GeminiError::Parse(format!("failed to parse transcription JSON: {e}")))
}
