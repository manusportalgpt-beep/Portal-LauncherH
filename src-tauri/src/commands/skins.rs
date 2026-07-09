use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct SkinInfo {
    pub url: String,
    pub variant: String, // "classic" or "slim"
    pub texture_id: String,
}

/// Get the active skin for the current authenticated user.
#[tauri::command]
pub async fn get_current_skin(access_token: Option<String>) -> Result<Option<SkinInfo>, String> {
    let token = match access_token {
        Some(t) if !t.is_empty() => t,
        _ => return Ok(None),
    };

    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .get("https://api.minecraftservices.com/minecraft/profile")
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?
        .json()
        .await
        .map_err(|e| format!("Parse error: {e}"))?;

    let skin = resp["skins"]
        .as_array()
        .and_then(|skins| skins.iter().find(|s| s["state"] == "ACTIVE"));

    match skin {
        Some(s) => Ok(Some(SkinInfo {
            url: s["url"].as_str().unwrap_or("").to_string(),
            variant: s["variant"].as_str().unwrap_or("CLASSIC").to_lowercase(),
            texture_id: s["id"].as_str().unwrap_or("").to_string(),
        })),
        None => Ok(None),
    }
}

/// Upload a skin PNG from raw bytes — avoids temp-file path issues in the frontend.
#[tauri::command]
pub async fn upload_skin_bytes(
    access_token: String,
    data: Vec<u8>,
    variant: String, // "classic" or "slim"
) -> Result<(), String> {
    upload_bytes_inner(access_token, data, variant).await
}

/// Upload a new skin PNG file to the Microsoft/Minecraft API.
/// Reads the file at `path` and PUTs it with the given variant.
#[tauri::command]
pub async fn upload_skin(
    access_token: String,
    path: String,
    variant: String, // "classic" or "slim"
) -> Result<(), String> {
    let data = std::fs::read(&path)
        .map_err(|e| format!("Failed to read skin file: {e}"))?;
    upload_bytes_inner(access_token, data, variant).await
}

async fn upload_bytes_inner(access_token: String, data: Vec<u8>, variant: String) -> Result<(), String> {

    let part = reqwest::multipart::Part::bytes(data)
        .file_name("skin.png")
        .mime_str("image/png")
        .map_err(|e| format!("MIME error: {e}"))?;

    let form = reqwest::multipart::Form::new()
        .text("variant", variant.to_uppercase())
        .part("file", part);

    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.minecraftservices.com/minecraft/profile/skins")
        .header("Authorization", format!("Bearer {}", access_token))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("Upload error: {e}"))?;

    if resp.status().is_success() {
        Ok(())
    } else {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        Err(format!("Upload failed ({}): {}", status, body))
    }
}
