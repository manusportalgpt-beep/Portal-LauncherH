#[tauri::command]
pub async fn search() -> Result<String, String> {
  Ok("modrinth_search".to_string())
}
