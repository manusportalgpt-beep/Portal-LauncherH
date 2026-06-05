#[tauri::command]
pub async fn launch_instance() -> Result<String, String> {
  Ok("launch_started".to_string())
}
