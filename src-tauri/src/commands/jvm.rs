#[tauri::command]
pub async fn get_java_info() -> Result<String, String> {
  Ok("java_info".to_string())
}
