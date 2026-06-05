use tauri::State;

#[tauri::command]
pub async fn start_device_code_flow(_state: State<'_, crate::AppState>) -> Result<String, String> {
  Ok("device_code_flow_started".to_string())
}

#[tauri::command]
pub async fn poll_for_token(_state: State<'_, crate::AppState>) -> Result<String, String> {
  Ok("token_poll_complete".to_string())
}
