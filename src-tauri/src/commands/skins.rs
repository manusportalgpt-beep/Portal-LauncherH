#[tauri::command]
pub async fn get_current_skin() -> Result<String, String> {
  Ok("skin_url".to_string())
}
