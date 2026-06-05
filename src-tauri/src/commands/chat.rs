#[tauri::command]
pub async fn send_message() -> Result<String, String> {
  Ok("message_sent".to_string())
}
