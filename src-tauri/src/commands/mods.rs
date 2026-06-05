#[tauri::command]
pub async fn search_mods() -> Result<String, String> {
  Ok("mod_search".to_string())
}
