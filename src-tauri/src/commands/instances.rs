#[tauri::command]
pub async fn get_instances() -> Result<String, String> {
  Ok("instance_list".to_string())
}
