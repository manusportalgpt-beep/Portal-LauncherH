#[tauri::command]
pub async fn list_audio_devices() -> Result<String, String> {
  Ok("device_list".to_string())
}
