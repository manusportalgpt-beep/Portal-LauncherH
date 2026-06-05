#[tauri::command]
pub async fn search() -> Result<String, String> {
  Ok("curseforge_search".to_string())
}
