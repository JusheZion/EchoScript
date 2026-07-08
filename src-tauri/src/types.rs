use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Emotion {
    Happy,
    Sad,
    Angry,
    Neutral,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionSegment {
    pub speaker: String,
    pub timestamp: String,
    pub content: String,
    pub language: String,
    pub language_code: String,
    #[serde(default)]
    pub translation: Option<String>,
    #[serde(default)]
    pub emotion: Option<Emotion>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TranscriptionResponse {
    pub summary: String,
    pub segments: Vec<TranscriptionSegment>,
}
