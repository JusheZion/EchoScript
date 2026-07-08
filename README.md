# EchoScript AI

A native macOS desktop app (built with [Tauri](https://tauri.app)) that transcribes audio with speaker diarization, timestamps, language detection, and emotion tagging via the Gemini API. Runs entirely locally — no server, no hosted backend. Your Gemini API key is stored in the macOS Keychain and only ever leaves your machine to call Gemini directly.

## Prerequisites

- Node.js
- Rust (`rustup`)
- Xcode Command Line Tools (`xcode-select --install`)

## Run locally

```
npm install
npm run tauri dev
```

On first launch you'll be prompted to paste a Gemini API key (get one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)). It's stored in Keychain, not in any file.

## Build a distributable app

```
npm run tauri build
```

The `.app` bundle is unsigned (no Apple Developer account configured), so the first launch needs a right-click → Open to get past Gatekeeper.

## Project layout

- `App.tsx`, `components/`, `services/` — React UI (Vite-bundled)
- `src-tauri/` — Rust backend: Gemini API calls (resumable file upload, `generateContent`), Keychain access, exposed to the UI as Tauri commands
