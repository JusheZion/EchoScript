use crate::{gemini, keychain, types::TranscriptionResponse};
use std::path::PathBuf;

#[tauri::command]
pub async fn transcribe_audio(path: String, mime_type: String) -> Result<TranscriptionResponse, String> {
    let api_key = keychain::get_key()?
        .ok_or_else(|| "No Gemini API key set. Add one in Settings.".to_string())?;
    let file_path = PathBuf::from(path);
    gemini::transcribe(&api_key, &file_path, &mime_type)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_gemini_api_key(key: String) -> Result<(), String> {
    let trimmed = key.trim();
    if trimmed.is_empty() {
        return Err("API key cannot be empty".into());
    }
    keychain::set_key(trimmed)
}

#[tauri::command]
pub fn has_gemini_api_key() -> Result<bool, String> {
    keychain::has_key()
}

#[tauri::command]
pub fn clear_gemini_api_key() -> Result<(), String> {
    keychain::clear_key()
}
