#[tauri::command]
pub async fn get_all() -> Result<String, String> {
  Ok("settings_loaded".to_string())
}
