#[tauri::command]
pub async fn get_friends() -> Result<String, String> {
  Ok("friends_list".to_string())
}
