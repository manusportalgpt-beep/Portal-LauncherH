#[tauri::command]
pub async fn install_forge() -> Result<String, String> {
  Ok("forge_install_started".to_string())
}
