mod commands;
mod gemini;
mod keychain;
mod types;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
        commands::transcribe_audio,
        commands::set_gemini_api_key,
        commands::has_gemini_api_key,
        commands::clear_gemini_api_key,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
