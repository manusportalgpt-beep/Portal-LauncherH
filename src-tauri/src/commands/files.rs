#[tauri::command]
pub async fn open_folder() -> Result<String, String> {
  Ok("folder_opened".to_string())
}
