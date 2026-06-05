#[tauri::command]
pub async fn send_offer() -> Result<String, String> {
  Ok("offer_sent".to_string())
}
