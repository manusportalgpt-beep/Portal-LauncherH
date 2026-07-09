use super::settings::read_curseforge_api_key;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CfAuthor { pub name: String }
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CfLogo { pub thumbnail_url: String }
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CfCategory { pub name: String }
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CfFileIndex { pub game_version: String, pub mod_loader_type: u32 }
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CurseforgeMod {
    pub id: u64,
    pub name: String,
    pub summary: String,
    pub authors: Vec<CfAuthor>,
    pub download_count: u64,
    pub thumbs_up_count: u64,
    pub logo: Option<CfLogo>,
    pub categories: Vec<CfCategory>,
    pub latest_files_indexes: Vec<CfFileIndex>,
    pub date_modified: String,
    pub slug: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct CfPagination { pub total_count: u64 }
#[derive(Serialize, Deserialize, Debug)]
pub struct CurseforgeSearchResult {
    pub data: Vec<CurseforgeMod>,
    pub pagination: CfPagination,
}

fn parse_mod(m: &serde_json::Value) -> CurseforgeMod {
    CurseforgeMod {
        id: m["id"].as_u64().unwrap_or(0),
        name: m["name"].as_str().unwrap_or("").to_string(),
        summary: m["summary"].as_str().unwrap_or("").to_string(),
        authors: m["authors"].as_array().map(|a| a.iter().map(|au| CfAuthor {
            name: au["name"].as_str().unwrap_or("").to_string()
        }).collect()).unwrap_or_default(),
        download_count: m["downloadCount"].as_u64().unwrap_or(0),
        thumbs_up_count: m["thumbsUpCount"].as_u64().unwrap_or(0),
        logo: m["logo"]["thumbnailUrl"].as_str().map(|u| CfLogo { thumbnail_url: u.to_string() }),
        categories: m["categories"].as_array().map(|a| a.iter().map(|c| CfCategory {
            name: c["name"].as_str().unwrap_or("").to_string()
        }).collect()).unwrap_or_default(),
        latest_files_indexes: m["latestFilesIndexes"].as_array().map(|a| a.iter().map(|f| CfFileIndex {
            game_version: f["gameVersion"].as_str().unwrap_or("").to_string(),
            mod_loader_type: f["modLoaderType"].as_u64().unwrap_or(0) as u32,
        }).collect()).unwrap_or_default(),
        date_modified: m["dateModified"].as_str().unwrap_or("").to_string(),
        slug: m["slug"].as_str().unwrap_or("").to_string(),
    }
}

fn cf_client(api_key: &str) -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("PortalLauncher/1.0.0")
        .default_headers({
            let mut h = reqwest::header::HeaderMap::new();
            h.insert("x-api-key", reqwest::header::HeaderValue::from_str(api_key).unwrap_or_else(|_| reqwest::header::HeaderValue::from_static("")));
            h
        })
        .build().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn search_curseforge(
    query: String,
    limit: Option<u64>,
    offset: Option<u64>,
    category_id: Option<u64>,
    class_id: Option<u64>,
    game_version: Option<String>,
    mod_loader_type: Option<u32>,
    sort_field: Option<u32>,
    api_key: String,
) -> Result<CurseforgeSearchResult, String> {
    let api_key = if api_key.is_empty() { read_curseforge_api_key() } else { api_key };
    if api_key.is_empty() {
        return Err("CurseForge API key not configured. Add it in Settings → Advanced.".into());
    }

    let client = cf_client(&api_key)?;
    let limit = limit.unwrap_or(20).min(50);
    let offset = offset.unwrap_or(0);
    let effective_class = class_id.unwrap_or(6).to_string();

    let mut req = client.get("https://api.curseforge.com/v1/mods/search")
        .query(&[
            ("gameId", "432"),
            ("classId", &effective_class),
            ("pageSize", &limit.to_string()),
            ("index", &offset.to_string()),
            ("searchFilter", &query),
            ("sortField", &sort_field.unwrap_or(2).to_string()),
            ("sortOrder", "desc"),
        ]);

    if let Some(cat) = category_id { req = req.query(&[("categoryId", cat.to_string())]); }
    if let Some(ver) = &game_version { 
        if !ver.is_empty() && ver != "All" { 
            req = req.query(&[("gameVersion", ver.as_str())]); 
        }
    }
    if let Some(ldr) = mod_loader_type { 
        if ldr > 0 { 
            req = req.query(&[("modLoaderType", ldr.to_string())]); 
        }
    }

    let resp: serde_json::Value = req.send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;

    // Handle both response formats (data array or error)
    if let Some(error) = resp["error"].as_str() {
        return Err(format!("CurseForge API error: {}", error));
    }
    
    let data: Vec<CurseforgeMod> = resp["data"].as_array().map(|a| a.iter().map(parse_mod).collect()).unwrap_or_default();
    let total = resp["pagination"]["totalCount"].as_u64().unwrap_or(data.len() as u64);
    Ok(CurseforgeSearchResult { data, pagination: CfPagination { total_count: total } })
}

/// Get files for a CurseForge mod (filtered by game version / loader)
#[tauri::command]
pub async fn get_curseforge_mod_files(
    mod_id: u64,
    game_version: Option<String>,
    mod_loader_type: Option<u32>,
    api_key: String,
) -> Result<serde_json::Value, String> {
    let api_key = if api_key.is_empty() { read_curseforge_api_key() } else { api_key };
    if api_key.is_empty() {
        return Err("CurseForge API key not configured.".into());
    }
    let client = cf_client(&api_key)?;
    let mut req = client.get(&format!("https://api.curseforge.com/v1/mods/{}/files", mod_id))
        .query(&[("pageSize", "20"), ("sortOrder", "desc")]);
    if let Some(v) = &game_version { req = req.query(&[("gameVersion", v.as_str())]); }
    if let Some(l) = mod_loader_type { req = req.query(&[("modLoaderType", l.to_string())]); }
    let resp: serde_json::Value = req.send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    Ok(resp)
}

/// Get the direct download URL for a specific CurseForge file
#[tauri::command]
pub async fn get_curseforge_file_download_url(
    mod_id: u64,
    file_id: u64,
    api_key: String,
) -> Result<String, String> {
    let api_key = if api_key.is_empty() { read_curseforge_api_key() } else { api_key };
    if api_key.is_empty() {
        return Err("CurseForge API key not configured.".into());
    }
    let client = cf_client(&api_key)?;
    let resp: serde_json::Value = client
        .get(&format!("https://api.curseforge.com/v1/mods/{}/files/{}/download-url", mod_id, file_id))
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    let url = resp["data"].as_str().unwrap_or("").to_string();
    if url.is_empty() {
        // Fallback: construct URL from file ID (works for most mods)
        let id_str = file_id.to_string();
        let part1 = &id_str[..4];
        let part2 = &id_str[4..];
        let file_resp: serde_json::Value = client
            .get(&format!("https://api.curseforge.com/v1/mods/{}/files/{}", mod_id, file_id))
            .send().await.map_err(|e| e.to_string())?
            .json().await.map_err(|e| e.to_string())?;
        let fname = file_resp["data"]["fileName"].as_str().unwrap_or("mod.jar");
        Ok(format!("https://edge.forgecdn.net/files/{}/{}/{}", part1, part2.trim_start_matches('0'), fname))
    } else {
        Ok(url)
    }
}

/// Get full mod details from CurseForge
#[tauri::command]
pub async fn get_curseforge_mod(
    mod_id: u64,
    api_key: String,
) -> Result<serde_json::Value, String> {
    let api_key = if api_key.is_empty() { read_curseforge_api_key() } else { api_key };
    if api_key.is_empty() {
        return Err("CurseForge API key not configured.".into());
    }
    let client = cf_client(&api_key)?;
    let resp: serde_json::Value = client
        .get(&format!("https://api.curseforge.com/v1/mods/{}", mod_id))
        .send().await.map_err(|e| e.to_string())?
        .json().await.map_err(|e| e.to_string())?;
    Ok(resp["data"].clone())
}
