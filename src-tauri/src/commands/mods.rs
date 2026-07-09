use serde::{Serialize, Deserialize};
use std::path::{Path, PathBuf};
use std::io::Read;
use tauri::Emitter;
use which::which;

/// Try to extract an icon from a mod jar/zip and return it as a base64 data URI.
/// Best-effort — returns None if nothing reasonable is found.
fn extract_jar_icon(jar_path: &Path) -> Option<String> {
    let data = std::fs::read(jar_path).ok()?;
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(data)).ok()?;

    // 1. fabric.mod.json declares icon path
    let icon_candidates: Vec<String> = {
        let mut paths: Vec<String> = vec![];
        if let Ok(mut fm) = archive.by_name("fabric.mod.json") {
            let mut s = String::new();
            if fm.read_to_string(&mut s).is_ok() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                    if let Some(icon) = v["icon"].as_str() { paths.push(icon.to_string()); }
                }
            }
        }
        paths.extend([
            "icon.png".to_string(),
            "pack.png".to_string(),
            "logo.png".to_string(),
            "logoFile.png".to_string(),
            "assets/icon.png".to_string(),
        ]);
        paths
    };

    for cand in &icon_candidates {
        if let Ok(mut entry) = archive.by_name(cand) {
            if entry.size() > 512 * 1024 { continue; } // skip huge images
            let mut buf = Vec::with_capacity(entry.size() as usize);
            if entry.read_to_end(&mut buf).is_ok() && !buf.is_empty() {
                let mime = if cand.ends_with(".png") || cand.ends_with(".PNG") { "image/png" }
                           else if cand.ends_with(".jpg") || cand.ends_with(".jpeg") { "image/jpeg" }
                           else { "image/png" };
                return Some(format!("data:{};base64,{}", mime, base64_encode(&buf)));
            }
        }
    }
    None
}

fn base64_encode(input: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::with_capacity((input.len() + 2) / 3 * 4);
    let mut i = 0;
    while i + 3 <= input.len() {
        let n = ((input[i] as u32) << 16) | ((input[i+1] as u32) << 8) | (input[i+2] as u32);
        out.push(T[((n >> 18) & 0x3f) as usize] as char);
        out.push(T[((n >> 12) & 0x3f) as usize] as char);
        out.push(T[((n >>  6) & 0x3f) as usize] as char);
        out.push(T[( n        & 0x3f) as usize] as char);
        i += 3;
    }
    let rem = input.len() - i;
    if rem == 1 {
        let n = (input[i] as u32) << 16;
        out.push(T[((n >> 18) & 0x3f) as usize] as char);
        out.push(T[((n >> 12) & 0x3f) as usize] as char);
        out.push_str("==");
    } else if rem == 2 {
        let n = ((input[i] as u32) << 16) | ((input[i+1] as u32) << 8);
        out.push(T[((n >> 18) & 0x3f) as usize] as char);
        out.push(T[((n >> 12) & 0x3f) as usize] as char);
        out.push(T[((n >>  6) & 0x3f) as usize] as char);
        out.push('=');
    }
    out
}


#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstalledMod {
    pub id: String,
    pub name: String,
    pub version: String,
    pub version_id: String,
    pub source: String,
    pub enabled: bool,
    pub file_name: String,
    pub file_size: u64,
    pub mod_type: String,
    pub author: Option<String>,
    pub icon_url: Option<String>,
    pub update_available: bool,
    pub latest_version: Option<String>,
    pub latest_version_id: Option<String>,
    pub latest_download_url: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModConflict { pub mod_a: String, pub mod_b: String, pub reason: String }

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateResult { pub mod_id: String, pub mod_name: String, pub old_version: String, pub new_version: String, pub success: bool, pub error: Option<String> }

fn mc_base_dir() -> PathBuf {
    crate::commands::version_manager::mc_base_dir()
}

fn instance_base(instance_id: &str) -> PathBuf {
    mc_base_dir().join("instances").join(instance_id)
}

fn mod_type_folder(mod_type: &str) -> &'static str {
    match mod_type {
        "resourcepack" | "resourcepacks" => "resourcepacks",
        "shaderpack" | "shaderpacks" | "shader" => "shaderpacks",
        "datapack" | "datapacks" => "datapacks",
        _ => "mods",
    }
}

fn detect_mod_type(categories: &[String], project_type: Option<&str>) -> &'static str {
    if let Some(pt) = project_type {
        match pt {
            "resourcepack" => return "resourcepack",
            "shader" => return "shaderpack",
            "datapack" => return "datapack",
            _ => {}
        }
    }
    for cat in categories {
        if cat.contains("resourcepack") { return "resourcepack"; }
        if cat.contains("shader") { return "shaderpack"; }
        if cat.contains("datapack") { return "datapack"; }
    }
    "mod"
}

fn instance_json_path(id: &str) -> PathBuf { instance_base(id).join("instance.json") }

fn get_instance_meta(id: &str) -> (String, String) {
    let path = instance_json_path(id);
    std::fs::read_to_string(&path).ok()
        .and_then(|d| serde_json::from_str::<serde_json::Value>(&d).ok())
        .map(|v| (v["mc_version"].as_str().unwrap_or("1.20.1").to_string(), v["loader"].as_str().unwrap_or("fabric").to_string()))
        .unwrap_or_else(|| ("1.20.1".to_string(), "fabric".to_string()))
}

fn game_dir(instance_id: &str) -> PathBuf {
    // Game files live in <instance>/.minecraft/ (Modrinth/MultiMC convention)
    instance_base(instance_id).join(".minecraft")
}

fn mods_dir_for(instance_id: &str, mod_type: &str) -> PathBuf {
    let p = game_dir(instance_id).join(mod_type_folder(mod_type));
    std::fs::create_dir_all(&p).ok(); p
}

fn update_instance_mod_list(instance_id: &str, m: &InstalledMod) {
    let path = instance_json_path(instance_id);
    if let Ok(data) = std::fs::read_to_string(&path) {
        if let Ok(mut config) = serde_json::from_str::<serde_json::Value>(&data) {
            let new_mod = serde_json::to_value(m).unwrap_or_default();
            match config["mods"].as_array_mut() {
                Some(arr) => arr.push(new_mod),
                None => config["mods"] = serde_json::json!([new_mod]),
            }
            if let Ok(json) = serde_json::to_string_pretty(&config) { std::fs::write(&path, json).ok(); }
        }
    }
}

#[tauri::command]
pub async fn search_mods(query: String, platform: String, limit: Option<u64>, curseforge_api_key: Option<String>) -> Result<serde_json::Value, String> {
    match platform.as_str() {
        "modrinth" => Ok(serde_json::to_value(super::modrinth::search_modrinth(query, limit, None, None, None, None, Some("relevance".into()), None).await?).unwrap()),
        "curseforge" => Ok(serde_json::to_value(super::curseforge::search_curseforge(query, limit, None, None, None, None, None, None, curseforge_api_key.unwrap_or_default()).await?).unwrap()),
        _ => {
            let (mr, cf) = tokio::join!(
                super::modrinth::search_modrinth(query.clone(), limit, None, None, None, None, None, None),
                super::curseforge::search_curseforge(query, limit, None, None, None, None, None, None, curseforge_api_key.unwrap_or_default())
            );
            Ok(serde_json::json!({"modrinth":mr.ok(),"curseforge":cf.ok()}))
        }
    }
}

/// Install a Modrinth mod and auto-download its dependencies
#[tauri::command]
pub async fn install_mod(
    app: tauri::AppHandle,
    instance_id: String, download_url: String, file_name: String,
    mod_id: String, mod_name: String, mod_version: String, version_id: String,
    source: String, mod_type: Option<String>, project_id: Option<String>,
    author: Option<String>, icon_url: Option<String>,
) -> Result<Vec<InstalledMod>, String> {
    let mtype = mod_type.as_deref().unwrap_or("mod");

    // Prefer lighty-launcher if available — delegate mod installation
    if which("lighty-launcher").is_ok() || which("npx").is_ok() {
        let mut cmd_opt = None;
        if which("lighty-launcher").is_ok() {
            let mut c = std::process::Command::new("lighty-launcher");
            c.arg("mod").arg("install").arg("--instance").arg(&instance_id).arg("--url").arg(&download_url).arg("--file").arg(&file_name);
            cmd_opt = Some(c);
        } else if which("npx").is_ok() {
            let mut c = std::process::Command::new("npx");
            c.arg("lighty-launcher").arg("mod").arg("install").arg("--instance").arg(&instance_id).arg("--url").arg(&download_url).arg("--file").arg(&file_name);
            cmd_opt = Some(c);
        }

        if let Some(mut cmd) = cmd_opt {
            let status = cmd.status().map_err(|e| format!("Failed to run lighty mod installer: {}", e))?;
            if status.success() {
                let mod_type_value = mod_type.as_deref().unwrap_or("mod").to_string();
                return Ok(vec![InstalledMod { id: mod_id.clone(), name: mod_name.clone(), version: mod_version.clone(), version_id: version_id.clone(), source: source.clone(), enabled: true, file_name: file_name.clone(), file_size: 0, mod_type: mod_type_value, author, icon_url, update_available: false, latest_version: None, latest_version_id: None, latest_download_url: None }]);
            }
            // If Lighty failed, fallthrough to manual install
        }
    }

    let client = reqwest::Client::builder().user_agent("PortalLauncher/1.1").build().map_err(|e| e.to_string())?;
    let dir = mods_dir_for(&instance_id, mtype);

    app.emit("mod-progress", serde_json::json!({"name":mod_name,"percent":20,"message":"Downloading mod..."})).ok();

    let bytes = client.get(&download_url).send().await.map_err(|e| format!("Download: {e}"))?.bytes().await.map_err(|e| format!("Read: {e}"))?;
    let file_size = bytes.len() as u64;
    std::fs::write(dir.join(&file_name), &bytes).map_err(|e| format!("Write: {e}"))?;

    let installed = InstalledMod {
        id: project_id.unwrap_or(mod_id), name: mod_name, version: mod_version, version_id: version_id.clone(),
        source: source.clone(), enabled: true, file_name, file_size,
        mod_type: mtype.to_string(), author, icon_url,
        update_available: false, latest_version: None, latest_version_id: None, latest_download_url: None,
    };
    update_instance_mod_list(&instance_id, &installed);

    app.emit("mod-progress", serde_json::json!({"name":installed.name,"percent":60,"message":"Checking dependencies..."})).ok();

    let mut all_installed = vec![installed.clone()];
    if source == "modrinth" && !version_id.is_empty() {
        let deps = install_mod_dependencies_internal(&client, &app, &instance_id, &version_id).await.unwrap_or_default();
        all_installed.extend(deps);
    }

    app.emit("mod-progress", serde_json::json!({"name":installed.name,"percent":100,"message":"Installed!"})).ok();
    Ok(all_installed)
}

/// Install a CurseForge mod by downloading its file via the API
#[tauri::command]
pub async fn install_curseforge_mod(
    app: tauri::AppHandle,
    instance_id: String,
    mod_id: u64,
    file_id: u64,
    file_name: String,
    mod_name: String,
    mod_version: String,
    mod_type: Option<String>,
    author: Option<String>,
    icon_url: Option<String>,
    api_key: String,
) -> Result<InstalledMod, String> {
    let client = reqwest::Client::builder().user_agent("PortalLauncher/1.1").build().map_err(|e| e.to_string())?;
    let mtype = mod_type.as_deref().unwrap_or("mod");
    let dir = mods_dir_for(&instance_id, mtype);

    app.emit("mod-progress", serde_json::json!({"name":mod_name,"percent":10,"message":"Getting download URL..."})).ok();

    // Get download URL from CurseForge API
    let download_url = super::curseforge::get_curseforge_file_download_url(
        mod_id, file_id, api_key.clone()
    ).await?;

    if download_url.is_empty() {
        return Err(format!("Could not get download URL for '{}'. This mod may restrict 3rd-party distribution.", mod_name));
    }

    // Prefer lighty-launcher if available — delegate mod installation
    if which("lighty-launcher").is_ok() || which("npx").is_ok() {
        let mut cmd_opt = None;
        if which("lighty-launcher").is_ok() {
            let mut c = std::process::Command::new("lighty-launcher");
            c.arg("mod").arg("install").arg("--instance").arg(&instance_id).arg("--url").arg(&download_url).arg("--file").arg(&file_name);
            cmd_opt = Some(c);
        } else if which("npx").is_ok() {
            let mut c = std::process::Command::new("npx");
            c.arg("lighty-launcher").arg("mod").arg("install").arg("--instance").arg(&instance_id).arg("--url").arg(&download_url).arg("--file").arg(&file_name);
            cmd_opt = Some(c);
        }

        if let Some(mut cmd) = cmd_opt {
            let status = cmd.status().map_err(|e| format!("Failed to run lighty mod installer: {}", e))?;
            if status.success() {
                let installed = InstalledMod { id: mod_id.to_string(), name: mod_name.clone(), version: mod_version.clone(), version_id: file_id.to_string(), source: "curseforge".to_string(), enabled: true, file_name: file_name.clone(), file_size: 0, mod_type: mtype.to_string(), author, icon_url, update_available: false, latest_version: None, latest_version_id: None, latest_download_url: None };
                update_instance_mod_list(&instance_id, &installed);
                app.emit("mod-progress", serde_json::json!({"name":installed.name,"percent":100,"message":"Installed from CurseForge via Lighty!"})).ok();
                return Ok(installed);
            }
            // If Lighty failed, fallthrough to manual install
        }
    }

    app.emit("mod-progress", serde_json::json!({"name":mod_name,"percent":30,"message":"Downloading..."})).ok();

    let resp = client.get(&download_url)
        .header("x-api-key", &api_key)
        .send().await.map_err(|e| format!("Download failed: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("Download failed: HTTP {}", resp.status()));
    }

    let bytes = resp.bytes().await.map_err(|e| format!("Read error: {e}"))?;
    let file_size = bytes.len() as u64;

    // Use a safe filename
    let safe_name = if file_name.is_empty() {
        format!("{}-cf-{}.jar", mod_name.replace(' ', "-"), file_id)
    } else {
        file_name.clone()
    };

    std::fs::write(dir.join(&safe_name), &bytes).map_err(|e| format!("Write error: {e}"))?;

    let installed = InstalledMod {
        id: mod_id.to_string(),
        name: mod_name,
        version: mod_version,
        version_id: file_id.to_string(),
        source: "curseforge".to_string(),
        enabled: true,
        file_name: safe_name,
        file_size,
        mod_type: mtype.to_string(),
        author,
        icon_url,
        // CurseForge mods: updates disabled to avoid conflicts
        update_available: false,
        latest_version: None,
        latest_version_id: None,
        latest_download_url: None,
    };

    update_instance_mod_list(&instance_id, &installed);

    app.emit("mod-progress", serde_json::json!({"name":installed.name,"percent":100,"message":"Installed from CurseForge!"})).ok();
    Ok(installed)
}

async fn install_mod_dependencies_internal(client: &reqwest::Client, app: &tauri::AppHandle, instance_id: &str, version_id: &str) -> Result<Vec<InstalledMod>, String> {
    let version_data: serde_json::Value = client.get(&format!("https://api.modrinth.com/v2/version/{}", version_id))
        .send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;

    let (mc_version, loader) = get_instance_meta(instance_id);
    let mut installed = vec![];

    if let Some(deps) = version_data["dependencies"].as_array() {
        for dep in deps {
            if dep["dependency_type"].as_str() != Some("required") { continue; }
            let dep_pid = dep["project_id"].as_str().unwrap_or("").to_string();
            let dep_vid = dep["version_id"].as_str().map(|s| s.to_string());
            if dep_pid.is_empty() { continue; }

            let mods_folder = game_dir(instance_id).join("mods");
            let _already = std::fs::read_dir(&mods_folder).ok()
                .map(|e| e.count()).unwrap_or(0) > 0;

            let dep_version_url = dep_vid.as_ref()
                .map(|vid| format!("https://api.modrinth.com/v2/version/{}", vid))
                .unwrap_or_else(|| format!("https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders=[\"{}\"]", dep_pid, mc_version, loader));

            if let Ok(dep_data) = (async { client.get(&dep_version_url).send().await?.json::<serde_json::Value>().await }).await {
                let dep_ver = if dep_vid.is_some() { dep_data.clone() } else {
                    dep_data.as_array().and_then(|a| a.first()).cloned().unwrap_or(dep_data)
                };

                if let Some(f) = dep_ver["files"].as_array().and_then(|a| a.first()) {
                    let url = f["url"].as_str().unwrap_or("").to_string();
                    let fname = f["filename"].as_str().unwrap_or("").to_string();
                    if url.is_empty() || fname.is_empty() { continue; }

                    let dir = game_dir(instance_id).join("mods");
                    std::fs::create_dir_all(&dir).ok();
                    if dir.join(&fname).exists() { continue; }

                    app.emit("mod-progress", serde_json::json!({"name":fname,"percent":70,"message":format!("Downloading dependency: {}", fname)})).ok();

                    if let Ok(bytes) = (async { client.get(&url).send().await?.bytes().await }).await {
                        let size = bytes.len() as u64;
                        std::fs::write(dir.join(&fname), &bytes).ok();
                        let dep_mod = InstalledMod {
                            id: dep_pid.clone(),
                            name: dep_ver["name"].as_str().unwrap_or(&dep_pid).to_string(),
                            version: dep_ver["version_number"].as_str().unwrap_or("").to_string(),
                            version_id: dep_ver["id"].as_str().unwrap_or("").to_string(),
                            source: "modrinth".to_string(), enabled: true, file_name: fname,
                            file_size: size, mod_type: "mod".to_string(),
                            author: None, icon_url: None,
                            update_available: false, latest_version: None, latest_version_id: None, latest_download_url: None,
                        };
                        update_instance_mod_list(instance_id, &dep_mod);
                        installed.push(dep_mod);
                    }
                }
            }
        }
    }
    Ok(installed)
}

/// Get the global PortalLauncher directory
fn global_mc_dir() -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("PortalLauncher")
}

#[tauri::command]
pub async fn get_instance_mods(instance_id: String) -> Result<Vec<InstalledMod>, String> {
    let base = instance_base(&instance_id);
    let stored: Vec<serde_json::Value> = std::fs::read_to_string(base.join("instance.json")).ok()
        .and_then(|d| serde_json::from_str::<serde_json::Value>(&d).ok())
        .and_then(|v| v["mods"].as_array().cloned())
        .unwrap_or_default();

    let mut mods = vec![];
    
    // First, check global .minecraft folders for shared mods/resourcepacks/shaders
    let global_base = global_mc_dir();
    for (folder, mtype) in &[("mods","mod"),("resourcepacks","resourcepack"),("shaderpacks","shaderpack")] {
        let global_dir = global_base.join(folder);
        if global_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&global_dir) {
                for entry in entries.flatten() {
                    let fname = entry.file_name().to_string_lossy().to_string();
                    let is_disabled = fname.ends_with(".disabled");
                    if !fname.ends_with(".jar") && !fname.ends_with(".zip") && !fname.ends_with(".disabled") { continue; }
                    let base_name = fname.trim_end_matches(".disabled");
                    let display = base_name.trim_end_matches(".jar").trim_end_matches(".zip").to_string();
                    let fsize = entry.metadata().map(|m| m.len()).unwrap_or(0);
                    let jar_icon = if fname.ends_with(".jar") || fname.ends_with(".jar.disabled") {
                        extract_jar_icon(&global_dir.join(&fname))
                    } else { None };
                    mods.push(InstalledMod {
                        id: display.clone(), name: display, version: String::new(), version_id: String::new(),
                        source: "global".to_string(), enabled: !is_disabled, file_name: fname, file_size: fsize,
                        mod_type: mtype.to_string(), author: None, icon_url: jar_icon,
                        update_available: false, latest_version: None, latest_version_id: None, latest_download_url: None,
                    });
                }
            }
        }
    }
    
    // Then check instance-specific folders (inside .minecraft subfolder)
    let mc_dir = game_dir(&instance_id);
    for (folder, mtype) in &[("mods","mod"),("resourcepacks","resourcepack"),("shaderpacks","shaderpack"),("datapacks","datapack")] {
        let dir = mc_dir.join(folder);
        if !dir.exists() { continue; }
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let entry_name = entry.file_name().to_string_lossy().to_string();
                // Skip kubejs folder (requires kubejs mod to work, useless without it)
                if entry_name == "kubejs" || entry_name.to_lowercase() == "kubejs" { continue; }
                let fname = entry_name;
                let is_disabled = fname.ends_with(".disabled");
                if !fname.ends_with(".jar") && !fname.ends_with(".zip") && !fname.ends_with(".disabled") { continue; }
                let base_name = fname.trim_end_matches(".disabled");
                let display = base_name.trim_end_matches(".jar").trim_end_matches(".zip").to_string();
                let fsize = entry.metadata().map(|m| m.len()).unwrap_or(0);
                let meta = stored.iter().find(|s| {
                    let sf = s["file_name"].as_str().unwrap_or("");
                    sf == fname || sf == base_name
                });
                if let Some(m) = meta {
                    mods.push(InstalledMod {
                        id: m["id"].as_str().unwrap_or(&display).to_string(),
                        name: m["name"].as_str().unwrap_or(&display).to_string(),
                        version: m["version"].as_str().unwrap_or("").to_string(),
                        version_id: m["version_id"].as_str().unwrap_or("").to_string(),
                        source: m["source"].as_str().unwrap_or("modrinth").to_string(),
                        enabled: !is_disabled,
                        file_name: fname, file_size: fsize,
                        mod_type: mtype.to_string(),
                        author: m["author"].as_str().map(|s| s.to_string()),
                        icon_url: m["icon_url"].as_str().map(|s| s.to_string()),
                        update_available: m["update_available"].as_bool().unwrap_or(false),
                        latest_version: m["latest_version"].as_str().map(|s| s.to_string()),
                        latest_version_id: m["latest_version_id"].as_str().map(|s| s.to_string()),
                        latest_download_url: m["latest_download_url"].as_str().map(|s| s.to_string()),
                    });
                } else {
                    let jar_icon = if fname.ends_with(".jar") || fname.ends_with(".jar.disabled") {
                        extract_jar_icon(&dir.join(&fname))
                    } else { None };
                    mods.push(InstalledMod {
                        id: display.clone(), name: display, version: String::new(), version_id: String::new(),
                        source: "manual".to_string(), enabled: !is_disabled, file_name: fname, file_size: fsize,
                        mod_type: mtype.to_string(), author: None, icon_url: jar_icon,
                        update_available: false, latest_version: None, latest_version_id: None, latest_download_url: None,
                    });
                }
            }
        }
    }
    Ok(mods)
}

#[tauri::command]
pub async fn toggle_mod(instance_id: String, file_name: String, mod_type: Option<String>, enabled: bool) -> Result<(), String> {
    let dir = mods_dir_for(&instance_id, mod_type.as_deref().unwrap_or("mod"));
    if enabled {
        let disabled = dir.join(format!("{}.disabled", file_name));
        if disabled.exists() { std::fs::rename(&disabled, dir.join(&file_name)).map_err(|e| e.to_string())?; }
    } else {
        let src = dir.join(&file_name);
        if src.exists() { std::fs::rename(&src, dir.join(format!("{}.disabled", file_name))).map_err(|e| e.to_string())?; }
    }
    Ok(())
}

#[tauri::command]
pub async fn remove_mod(instance_id: String, file_name: String, mod_type: Option<String>) -> Result<(), String> {
    let dir = mods_dir_for(&instance_id, mod_type.as_deref().unwrap_or("mod"));
    let path = dir.join(&file_name);
    if path.exists() { std::fs::remove_file(&path).map_err(|e| format!("Remove: {e}"))?; }
    let dis = dir.join(format!("{}.disabled", file_name));
    if dis.exists() { std::fs::remove_file(&dis).ok(); }
    Ok(())
}

/// Check for updates — CurseForge mods are SKIPPED (no auto-update to avoid conflicts)
#[tauri::command]
pub async fn check_mod_updates(instance_id: String) -> Result<Vec<InstalledMod>, String> {
    let client = reqwest::Client::builder().user_agent("PortalLauncher/1.1").build().map_err(|e| e.to_string())?;
    let (mc_version, loader) = get_instance_meta(&instance_id);
    let mut mods = get_instance_mods(instance_id.clone()).await?;
    let stored: Vec<serde_json::Value> = std::fs::read_to_string(instance_json_path(&instance_id)).ok()
        .and_then(|d| serde_json::from_str::<serde_json::Value>(&d).ok())
        .and_then(|v| v["mods"].as_array().cloned()).unwrap_or_default();

    for m in &mut mods {
        // CurseForge mods: skip updates entirely (source separation)
        if m.source == "curseforge" || m.source == "manual" {
            m.update_available = false;
            continue;
        }

        let stored_entry = stored.iter().find(|s| s["file_name"].as_str() == Some(&m.file_name) || s["name"].as_str() == Some(&m.name));
        let project_id = stored_entry.and_then(|s| s["id"].as_str()).unwrap_or("").to_string();
        let current_vid = stored_entry.and_then(|s| s["version_id"].as_str()).unwrap_or("").to_string();
        if project_id.is_empty() { continue; }

        let url = format!("https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders=[\"{}\"]", project_id, mc_version, loader);
        if let Ok(resp) = client.get(&url).send().await {
            if let Ok(versions) = resp.json::<serde_json::Value>().await {
                if let Some(latest) = versions.as_array().and_then(|a| a.first()) {
                    let latest_id = latest["id"].as_str().unwrap_or("").to_string();
                    if !latest_id.is_empty() && latest_id != current_vid {
                        m.update_available = true;
                        m.latest_version = latest["version_number"].as_str().map(|s| s.to_string());
                        m.latest_version_id = Some(latest_id);
                        m.latest_download_url = latest["files"].as_array().and_then(|f| f.first()).and_then(|f| f["url"].as_str()).map(|s| s.to_string());
                    }
                }
            }
        }
    }
    Ok(mods)
}

/// Update all Modrinth mods — CurseForge mods are excluded from auto-update
#[tauri::command]
pub async fn update_all_mods(app: tauri::AppHandle, instance_id: String) -> Result<Vec<UpdateResult>, String> {
    let client = reqwest::Client::builder().user_agent("PortalLauncher/1.1").build().map_err(|e| e.to_string())?;
    let mods = check_mod_updates(instance_id.clone()).await?;
    // Only update Modrinth mods with available updates
    let updatable: Vec<_> = mods.iter()
        .filter(|m| m.update_available && m.source == "modrinth")
        .collect();
    let total = updatable.len();
    let mut results = vec![];

    for (i, m) in updatable.iter().enumerate() {
        let url = match &m.latest_download_url { Some(u) => u.clone(), None => continue };
        let new_ver = m.latest_version.clone().unwrap_or_default();
        app.emit("mod-progress", serde_json::json!({"name":m.name,"percent":(i*100/total.max(1)) as u8,"message":format!("Updating {} ({}/{})", m.name, i+1, total)})).ok();

        let dir = mods_dir_for(&instance_id, &m.mod_type);
        match (async { client.get(&url).send().await?.bytes().await }).await {
            Ok(bytes) => {
                std::fs::remove_file(dir.join(&m.file_name)).ok();
                let new_fname = format!("{}-{}.jar", m.name.replace(' ', "-"), new_ver);
                std::fs::write(dir.join(&new_fname), &bytes).ok();
                results.push(UpdateResult { mod_id: m.id.clone(), mod_name: m.name.clone(), old_version: m.version.clone(), new_version: new_ver, success: true, error: None });
            }
            Err(e) => results.push(UpdateResult { mod_id: m.id.clone(), mod_name: m.name.clone(), old_version: m.version.clone(), new_version: new_ver, success: false, error: Some(e.to_string()) }),
        }
    }
    app.emit("mod-progress", serde_json::json!({"name":"All","percent":100,"message":format!("{} mods updated", results.iter().filter(|r| r.success).count())})).ok();
    Ok(results)
}

#[tauri::command]
pub async fn detect_mod_conflicts(instance_id: String) -> Result<Vec<ModConflict>, String> {
    let mods = get_instance_mods(instance_id).await?;
    let mut conflicts = vec![];
    for i in 0..mods.len() {
        for j in (i+1)..mods.len() {
            let (a, b) = (&mods[i], &mods[j]);
            let (na, nb) = (a.name.to_lowercase().replace(['-','_',' '], ""), b.name.to_lowercase().replace(['-','_',' '], ""));
            if na == nb { conflicts.push(ModConflict { mod_a: a.name.clone(), mod_b: b.name.clone(), reason: "Duplicate mod installed twice".to_string() }); }
            // Modrinth + CurseForge same mod conflict detection
            if (a.source == "modrinth" && b.source == "curseforge") || (a.source == "curseforge" && b.source == "modrinth") {
                if na.len() > 4 && nb.contains(&na[..na.len().min(8)]) {
                    conflicts.push(ModConflict { mod_a: a.name.clone(), mod_b: b.name.clone(), reason: "Possible duplicate: same mod from Modrinth and CurseForge".to_string() });
                }
            }
        }
    }
    let known: &[(&str, &str, &str)] = &[
        ("optifine","sodium","OptiFine and Sodium are incompatible — use Iris+Sodium instead"),
        ("optifine","rubidium","OptiFine and Rubidium are incompatible"),
        ("journeymap","xaeros","JourneyMap and Xaero's conflict — use one minimap only"),
    ];
    let names: Vec<_> = mods.iter().map(|m| m.name.to_lowercase().replace(['-','_',' '], "")).collect();
    for (a, b, reason) in known {
        if names.iter().any(|n| n.contains(a)) && names.iter().any(|n| n.contains(b)) {
            conflicts.push(ModConflict {
                mod_a: mods.iter().find(|m| m.name.to_lowercase().replace(['-','_',' '], "").contains(a)).map(|m| m.name.clone()).unwrap_or_else(|| a.to_string()),
                mod_b: mods.iter().find(|m| m.name.to_lowercase().replace(['-','_',' '], "").contains(b)).map(|m| m.name.clone()).unwrap_or_else(|| b.to_string()),
                reason: reason.to_string(),
            });
        }
    }
    Ok(conflicts)
}

#[tauri::command]
pub async fn check_mod_compatibility(instance_id: String, project_id: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder().user_agent("PortalLauncher/1.1").build().map_err(|e| e.to_string())?;
    let (mc_version, loader) = get_instance_meta(&instance_id);
    let url = format!("https://api.modrinth.com/v2/project/{}/version?game_versions=[\"{}\"]&loaders=[\"{}\"]", project_id, mc_version, loader);
    let resp: serde_json::Value = client.get(&url).send().await.map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let compatible = resp.as_array().map(|a| !a.is_empty()).unwrap_or(false);
    Ok(serde_json::json!({"compatible":compatible,"mc_version":mc_version,"loader":loader,"latest_compatible_version":resp.as_array().and_then(|a| a.first()).cloned(),"message":if compatible { format!("Compatible with MC {} ({})", mc_version, loader) } else { format!("NOT compatible with MC {} ({})", mc_version, loader) }}))
}
