#[tauri::command]
pub async fn get_installed_versions() -> Result<String, String> {
  Ok("installed_versions".to_string())
}
