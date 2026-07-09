use serde::{Serialize, Deserialize};
use std::path::PathBuf;
use std::io::{Write, Read};
use tauri::Emitter;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct InstanceMod {
    pub id: String,
    pub name: String,
    pub version: String,
    pub source: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub description: String,
    pub mc_version: String,
    pub loader: String,
    pub loader_version: String,
    pub min_ram: u32,
    pub max_ram: u32,
    pub java_path: String,
    pub custom_jvm_args: String,
    pub play_time_minutes: u64,
    pub last_played: Option<String>,
    pub created_at: String,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub mods: Vec<InstanceMod>,
}

fn mc_base_dir() -> PathBuf {
    crate::commands::version_manager::mc_base_dir()
}

fn instances_dir() -> PathBuf {
    let p = mc_base_dir().join("instances");
    std::fs::create_dir_all(&p).ok();
    p
}

fn instance_path(id: &str) -> PathBuf { instances_dir().join(id).join("instance.json") }

/// Convert an instance name into a filesystem-safe folder name
fn slugify_name(name: &str) -> String {
    let slug: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() { c.to_ascii_lowercase() } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    if slug.is_empty() { "instance".to_string() } else { slug }
}

fn load_instance(id: &str) -> Option<Instance> {
    serde_json::from_str(&std::fs::read_to_string(instance_path(id)).ok()?).ok()
}

fn save_instance(instance: &Instance) -> Result<(), String> {
    let dir = instances_dir().join(&instance.id);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(dir.join("instance.json"), serde_json::to_string_pretty(instance).map_err(|e| e.to_string())?).map_err(|e| e.to_string())
}

/// Create the full instance folder structure like a real Minecraft install
fn create_instance_folders(instance_dir: &PathBuf) -> Result<(), String> {
    // Game data lives in <instance>/.minecraft/ — same as Modrinth/MultiMC convention
    let mc = instance_dir.join(".minecraft");
    let folders = [
        "mods", "resourcepacks", "shaderpacks", "datapacks",
        "saves", "config", "logs", "screenshots", "crash-reports",
        "schematics", "scripts",
    ];
    for folder in &folders {
        std::fs::create_dir_all(mc.join(folder)).map_err(|e| e.to_string())?;
    }
    // Create default options.txt inside .minecraft
    let options_path = mc.join("options.txt");
    if !options_path.exists() {
        let default_options = "version:3465\ngamma:0.0\nrenderDistance:12\nsimulationDistance:12\nguiScale:0\nfullscreen:false\nsoundCategory_master:1.0\nsoundCategory_music:1.0\n";
        std::fs::write(&options_path, default_options).ok();
    }
    Ok(())
}

#[tauri::command]
pub async fn get_instances() -> Result<Vec<Instance>, String> {
    let dir = instances_dir();
    let mut instances = vec![];
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(inst) = load_instance(&entry.file_name().to_string_lossy()) { instances.push(inst); }
            }
        }
    }
    instances.sort_by(|a, b| b.last_played.cmp(&a.last_played));
    Ok(instances)
}

#[tauri::command]
pub async fn create_instance(
    app: tauri::AppHandle,
    name: String, description: String, mc_version: String,
    loader: String, loader_version: String, min_ram: u32, max_ram: u32, color: Option<String>,
) -> Result<Instance, String> {
    // Use human-readable folder name: "my-cool-pack-a1b2c3d4"
    let id = slugify_name(&name);
    let instance = Instance {
        id: id.clone(), name: name.clone(), description, mc_version: mc_version.clone(),
        loader, loader_version, min_ram, max_ram,
        java_path: String::new(), custom_jvm_args: String::new(),
        play_time_minutes: 0, last_played: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        icon: None, color, mods: vec![],
    };
    // Emit progress: creating folders
    app.emit("instance-progress", serde_json::json!({"stage":"creating","name":name,"percent":20,"message":"Creating instance folders..."})).ok();
    let instance_dir = instances_dir().join(&id);
    create_instance_folders(&instance_dir)?;
    app.emit("instance-progress", serde_json::json!({"stage":"saving","name":name,"percent":80,"message":"Saving configuration..."})).ok();
    save_instance(&instance)?;
    app.emit("instance-progress", serde_json::json!({"stage":"done","name":name,"percent":100,"message":"Instance created!"})).ok();
    Ok(instance)
}

#[tauri::command]
pub async fn update_instance(id: String, updates: serde_json::Value) -> Result<Instance, String> {
    let mut inst = load_instance(&id).ok_or("Instance not found")?;
    if let Some(v) = updates["name"].as_str() { inst.name = v.to_string(); }
    if let Some(v) = updates["description"].as_str() { inst.description = v.to_string(); }
    if let Some(v) = updates["min_ram"].as_u64() { inst.min_ram = v as u32; }
    if let Some(v) = updates["max_ram"].as_u64() { inst.max_ram = v as u32; }
    if let Some(v) = updates["java_path"].as_str() { inst.java_path = v.to_string(); }
    if let Some(v) = updates["custom_jvm_args"].as_str() { inst.custom_jvm_args = v.to_string(); }
    if let Some(v) = updates["loader_version"].as_str() { inst.loader_version = v.to_string(); }
    if let Some(v) = updates["color"].as_str() { inst.color = Some(v.to_string()); }
    save_instance(&inst)?;
    Ok(inst)
}

#[tauri::command]
pub async fn delete_instance(id: String) -> Result<(), String> {
    let dir = instances_dir().join(&id);
    if !dir.exists() { return Ok(()); }
    std::fs::remove_dir_all(&dir).map_err(|e| format!("Delete: {e}"))
}

/// Make sure an instance.json exists on disk for the given id.
/// Used by the frontend right before launch, in case the instance was created
/// only in the local store (e.g. when `create_instance` failed earlier or the
/// app was offline). Idempotent: if instance.json already exists it is
/// returned untouched.
#[tauri::command]
pub async fn ensure_instance(
    id: String,
    name: String,
    mc_version: String,
    loader: String,
    loader_version: Option<String>,
    min_ram: Option<u32>,
    max_ram: Option<u32>,
    java_path: Option<String>,
    custom_jvm_args: Option<String>,
    color: Option<String>,
    icon: Option<String>,
) -> Result<Instance, String> {
    if let Some(existing) = load_instance(&id) {
        return Ok(existing);
    }
    let instance = Instance {
        id: id.clone(),
        name,
        description: String::new(),
        mc_version,
        loader,
        loader_version: loader_version.unwrap_or_default(),
        min_ram: min_ram.unwrap_or(1024),
        max_ram: max_ram.unwrap_or(4096),
        java_path: java_path.unwrap_or_default(),
        custom_jvm_args: custom_jvm_args.unwrap_or_default(),
        play_time_minutes: 0,
        last_played: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        icon,
        color,
        mods: vec![],
    };
    let dir = instances_dir().join(&id);
    create_instance_folders(&dir)?;
    save_instance(&instance)?;
    Ok(instance)
}

#[tauri::command]
pub async fn duplicate_instance(app: tauri::AppHandle, id: String, new_name: String) -> Result<Instance, String> {
    let src_dir = instances_dir().join(&id);
    let mut inst = load_instance(&id).ok_or("Instance not found")?;
    inst.id = uuid::Uuid::new_v4().to_string();
    inst.name = new_name.clone();
    inst.created_at = chrono::Utc::now().to_rfc3339();
    inst.last_played = None;
    inst.play_time_minutes = 0;

    app.emit("instance-progress", serde_json::json!({"stage":"cloning","name":new_name,"percent":10,"message":"Cloning instance..."})).ok();

    let dst_dir = instances_dir().join(&inst.id);
    std::fs::create_dir_all(&dst_dir).map_err(|e| e.to_string())?;
    create_instance_folders(&dst_dir)?;

    // Copy mods, config, resourcepacks, shaderpacks
    for folder in &["mods", "config", "resourcepacks", "shaderpacks", "datapacks", "schematics"] {
        let src = src_dir.join(folder);
        if src.exists() { copy_dir_all(&src, &dst_dir.join(folder)).ok(); }
    }

    app.emit("instance-progress", serde_json::json!({"stage":"saving","name":new_name,"percent":90,"message":"Saving clone..."})).ok();
    save_instance(&inst)?;
    app.emit("instance-progress", serde_json::json!({"stage":"done","name":new_name,"percent":100,"message":"Cloned!"})).ok();
    Ok(inst)
}

fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        if entry.file_type()?.is_dir() { copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?; }
        else { std::fs::copy(entry.path(), dst.join(entry.file_name()))?; }
    }
    Ok(())
}

#[tauri::command]
pub async fn open_instance_folder(id: String) -> Result<(), String> {
    let dir = instances_dir().join(&id);
    #[cfg(target_os = "windows")] std::process::Command::new("explorer").arg(&dir).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")] std::process::Command::new("open").arg(&dir).spawn().map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")] std::process::Command::new("xdg-open").arg(&dir).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn export_instance_zip(app: tauri::AppHandle, id: String, dest_path: String) -> Result<String, String> {
    let src_dir = instances_dir().join(&id);
    if !src_dir.exists() { return Err(format!("Instance {} not found", id)); }
    let inst = load_instance(&id).ok_or("Instance not found")?;

    app.emit("instance-progress", serde_json::json!({"stage":"exporting","name":inst.name,"percent":10,"message":"Packing files..."})).ok();

    let dest = if dest_path.is_empty() {
        let n = inst.name.replace(|c: char| !c.is_alphanumeric() && c != '-', "_");
        instances_dir().parent().unwrap_or(&src_dir).join(format!("{}-export.zip", n))
    } else { PathBuf::from(&dest_path) };

    let file = std::fs::File::create(&dest).map_err(|e| format!("Create zip: {e}"))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated).unix_permissions(0o755);
    add_dir_to_zip(&mut zip, &src_dir, &src_dir, &options)?;
    zip.finish().map_err(|e| format!("Zip finish: {e}"))?;

    app.emit("instance-progress", serde_json::json!({"stage":"done","name":inst.name,"percent":100,"message":"Export complete!"})).ok();
    Ok(dest.to_string_lossy().to_string())
}

fn add_dir_to_zip(zip: &mut zip::ZipWriter<std::fs::File>, base: &PathBuf, dir: &PathBuf, options: &zip::write::FileOptions<()>) -> Result<(), String> {
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let rel = path.strip_prefix(base).map_err(|e| e.to_string())?.to_string_lossy().replace('\\', "/");
            if path.is_dir() {
                zip.add_directory(&rel, *options).map_err(|e| e.to_string())?;
                add_dir_to_zip(zip, base, &path, options)?;
            } else {
                zip.start_file(&rel, *options).map_err(|e| e.to_string())?;
                zip.write_all(&std::fs::read(&path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
            }
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn import_instance_zip(app: tauri::AppHandle, zip_path: String, new_name: Option<String>) -> Result<Instance, String> {
    app.emit("instance-progress", serde_json::json!({"stage":"importing","name":new_name.clone().unwrap_or("Instance".into()),"percent":10,"message":"Reading ZIP..."})).ok();
    let zip_file = std::fs::File::open(&zip_path).map_err(|e| format!("Open zip: {e}"))?;
    let mut archive = zip::ZipArchive::new(zip_file).map_err(|e| format!("Read zip: {e}"))?;
    let new_id = uuid::Uuid::new_v4().to_string();
    let dest_dir = instances_dir().join(&new_id);
    std::fs::create_dir_all(&dest_dir).map_err(|e| e.to_string())?;
    let total = archive.len();
    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = dest_dir.join(entry.name());
        if entry.is_dir() { std::fs::create_dir_all(&outpath).ok(); }
        else {
            if let Some(p) = outpath.parent() { std::fs::create_dir_all(p).ok(); }
            let mut outf = std::fs::File::create(&outpath).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outf).map_err(|e| e.to_string())?;
        }
        if i % 20 == 0 {
            let pct = 10 + (i as u64 * 80) / total.max(1) as u64;
            app.emit("instance-progress", serde_json::json!({"stage":"extracting","name":"Instance","percent":pct,"message":format!("Extracting {}/{}", i, total)})).ok();
        }
    }
    let json_path = dest_dir.join("instance.json");
    let mut instance: Instance = if json_path.exists() {
        serde_json::from_str(&std::fs::read_to_string(&json_path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?
    } else { return Err("No instance.json in ZIP".to_string()); };
    instance.id = new_id;
    if let Some(name) = new_name { instance.name = name; }
    instance.last_played = None;
    instance.play_time_minutes = 0;
    create_instance_folders(&dest_dir)?;
    save_instance(&instance)?;
    app.emit("instance-progress", serde_json::json!({"stage":"done","name":instance.name,"percent":100,"message":"Import complete!"})).ok();
    Ok(instance)
}

#[tauri::command]
pub async fn import_modrinth_pack(app: tauri::AppHandle, mrpack_path: String) -> Result<Instance, String> {
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(300)).user_agent("PortalLauncher/1.3").build().map_err(|e| e.to_string())?;
    let file = std::fs::File::open(&mrpack_path).map_err(|e| format!("Open: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Read: {e}"))?;

    let index_data = {
        let mut f = archive.by_name("modrinth.index.json").map_err(|_| "No modrinth.index.json".to_string())?;
        let mut s = String::new(); f.read_to_string(&mut s).map_err(|e| e.to_string())?; s
    };
    let index: serde_json::Value = serde_json::from_str(&index_data).map_err(|e| e.to_string())?;
    let pack_name = index["name"].as_str().unwrap_or("Modrinth Pack").to_string();
    app.emit("instance-progress", serde_json::json!({"stage":"importing","name":pack_name,"percent":5,"message":"Reading pack manifest..."})).ok();

    let mc_version = index["dependencies"]["minecraft"].as_str().unwrap_or("1.20.1").to_string();
    let (loader, loader_version) = if index["dependencies"]["fabric-loader"].is_string() {
        ("fabric", index["dependencies"]["fabric-loader"].as_str().unwrap_or(""))
    } else if index["dependencies"]["quilt-loader"].is_string() {
        ("quilt", index["dependencies"]["quilt-loader"].as_str().unwrap_or(""))
    } else if index["dependencies"]["neoforge"].is_string() {
        ("neoforge", index["dependencies"]["neoforge"].as_str().unwrap_or(""))
    } else if index["dependencies"]["forge"].is_string() {
        ("forge", index["dependencies"]["forge"].as_str().unwrap_or(""))
    } else { ("vanilla", "") };

    let new_id = uuid::Uuid::new_v4().to_string();
    let dest_dir = instances_dir().join(&new_id);
    create_instance_folders(&dest_dir)?;

    // The actual game files live inside .minecraft/ (MultiMC / Modrinth convention).
    let mc_dir = dest_dir.join(".minecraft");

    // ── Pack icon ──────────────────────────────────────────────────────────────
    // Try common icon filenames inside the mrpack archive.
    let icon_b64: Option<String> = {
        let mut found: Option<String> = None;
        for candidate in &["icon.png", "pack.png", "icon.jpg"] {
            if let Ok(mut f) = archive.by_name(candidate) {
                let mut buf = vec![];
                std::io::Read::read_to_end(&mut f, &mut buf).ok();
                if !buf.is_empty() {
                    use base64::Engine as _;
                    let encoded = base64::engine::general_purpose::STANDARD.encode(&buf);
                    let mime = if candidate.ends_with(".jpg") { "image/jpeg" } else { "image/png" };
                    found = Some(format!("data:{};base64,{}", mime, encoded));
                    break;
                }
            }
        }
        found
    };
    // Save icon to disk as well so it persists between sessions
    if let Some(ref b64) = icon_b64 {
        let icon_path = dest_dir.join("icon.png");
        if let Some(data_part) = b64.split(',').nth(1) {
            use base64::Engine as _;
            if let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(data_part) {
                std::fs::write(&icon_path, bytes).ok();
            }
        }
    }

    // ── Extract overrides into .minecraft/ ────────────────────────────────────
    app.emit("instance-progress", serde_json::json!({"stage":"extracting","name":pack_name,"percent":15,"message":"Extracting overrides..."})).ok();
    let override_names: Vec<String> = (0..archive.len())
        .filter_map(|i| archive.by_index(i).ok().map(|e| e.name().to_string()))
        .filter(|n| (n.starts_with("overrides/") || n.starts_with("client-overrides/")) && !n.ends_with('/'))
        .collect();
    for name in &override_names {
        let mut entry = archive.by_name(name).map_err(|e| e.to_string())?;
        let strip = if name.starts_with("client-overrides/") { "client-overrides/".len() } else { "overrides/".len() };
        let rel = &name[strip..];
        // Overrides go into .minecraft/ (matches Modrinth Launcher behaviour)
        let out = mc_dir.join(rel);
        if let Some(p) = out.parent() { std::fs::create_dir_all(p).ok(); }
        let mut outf = std::fs::File::create(&out).map_err(|e| e.to_string())?;
        std::io::copy(&mut entry, &mut outf).map_err(|e| e.to_string())?;
    }

    // ── Download files (mods, resource-packs, etc.) into .minecraft/ ──────────
    let files = index["files"].as_array().cloned().unwrap_or_default();
    let total_files = files.len();
    app.emit("instance-progress", serde_json::json!({"stage":"downloading","name":pack_name,"percent":30,"message":format!("Downloading {} files...", total_files)})).ok();
    let mut mods = vec![];
    for (i, file_entry) in files.iter().enumerate() {
        let path = file_entry["path"].as_str().unwrap_or("");
        let url = file_entry["downloads"].as_array()
            .and_then(|a| a.first()).and_then(|u| u.as_str()).unwrap_or("");
        if url.is_empty() || path.is_empty() { continue; }
        // All paths in modrinth.index.json are relative to .minecraft/
        let out_path = mc_dir.join(path);
        if let Some(p) = out_path.parent() { std::fs::create_dir_all(p).ok(); }
        if let Ok(bytes) = (async { client.get(url).send().await?.bytes().await }).await {
            std::fs::write(&out_path, &bytes).ok();
            if path.starts_with("mods/") {
                let fname = out_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                mods.push(InstanceMod {
                    id: fname.clone(),
                    name: fname.trim_end_matches(".jar").to_string(),
                    version: "imported".to_string(),
                    source: "modrinth".to_string(),
                    enabled: true,
                });
            }
        }
        let pct = 30 + (i as u64 * 65) / total_files.max(1) as u64;
        app.emit("instance-progress", serde_json::json!({"stage":"downloading","name":pack_name,"percent":pct,"message":format!("Downloaded {}/{}", i+1, total_files)})).ok();
    }

    let instance = Instance {
        id: new_id, name: pack_name, description: "Imported from Modrinth Pack".to_string(),
        mc_version, loader: loader.to_string(), loader_version: loader_version.to_string(),
        min_ram: 2048, max_ram: 6144, java_path: String::new(), custom_jvm_args: String::new(),
        play_time_minutes: 0, last_played: None, created_at: chrono::Utc::now().to_rfc3339(),
        icon: icon_b64, color: Some("#6C5CE7".to_string()), mods,
    };
    save_instance(&instance)?;
    app.emit("instance-progress", serde_json::json!({"stage":"done","name":instance.name,"percent":100,"message":"Pack imported!"})).ok();
    Ok(instance)
}

/// Import instance from Prism Launcher ZIP export
#[tauri::command]
pub async fn import_prismlauncher_instance(app: tauri::AppHandle, zip_path: String) -> Result<Instance, String> {
    app.emit("instance-progress", serde_json::json!({"stage":"importing","name":"Prism Instance","percent":5,"message":"Reading ZIP..."})).ok();
    
    let file = std::fs::File::open(&zip_path).map_err(|e| format!("Open ZIP: {e}"))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Read ZIP: {e}"))?;
    
    // Find instance.cfg (Prism Launcher config)
    let mut instance_name = "Prism Import".to_string();
    let mut mc_version = "1.20.1".to_string();
    let mut loader = "vanilla".to_string();
    let mut loader_version = String::new();
    let min_ram = 2048u32;
    let max_ram = 4096u32;
    
    // Try to read instance.cfg
    if let Ok(mut cfg_file) = archive.by_name("instance.cfg") {
        let mut cfg_content = String::new();
        if cfg_file.read_to_string(&mut cfg_content).is_ok() {
            // Parse INI-like format
            for line in cfg_content.lines() {
                let line = line.trim();
                if line.starts_with("name=") {
                    instance_name = line.trim_start_matches("name=").trim_matches('"').to_string();
                } else if line.starts_with("IntendedVersion=") {
                    mc_version = line.trim_start_matches("IntendedVersion=").trim_matches('"').to_string();
                } else if line.starts_with("Loader=") {
                    loader = line.trim_start_matches("Loader=").trim_matches('"').to_string().to_lowercase();
                } else if line.starts_with("LoaderVersion=") {
                    loader_version = line.trim_start_matches("LoaderVersion=").trim_matches('"').to_string();
                }
            }
        }
    }
    
    // Try to read mmc-pack.json for more accurate version info
    if let Ok(mut pack_file) = archive.by_name("mmc-pack.json") {
        let mut pack_content = String::new();
        if pack_file.read_to_string(&mut pack_content).is_ok() {
            if let Ok(pack_data) = serde_json::from_str::<serde_json::Value>(&pack_content) {
                if let Some(components) = pack_data["components"].as_array() {
                    for comp in components {
                        let uid = comp["uid"].as_str().unwrap_or("");
                        let version = comp["version"].as_str().unwrap_or("").to_string();
                        if uid.contains("net.minecraft") {
                            mc_version = version;
                        } else if uid.contains("net.fabricmc.fabric-loader") {
                            loader = "fabric".to_string();
                            loader_version = version;
                        } else if uid.contains("net.minecraftforge") {
                            loader = "forge".to_string();
                            loader_version = version;
                        } else if uid.contains("org.quiltmc.quilt-loader") {
                            loader = "quilt".to_string();
                            loader_version = version;
                        } else if uid.contains("net.neoforged") {
                            loader = "neoforge".to_string();
                            loader_version = version;
                        }
                    }
                }
            }
        }
    }
    
    let new_id = uuid::Uuid::new_v4().to_string();
    let dest_dir = instances_dir().join(&new_id);
    create_instance_folders(&dest_dir)?;
    
    // Extract all files from ZIP to instance folder
    let total = archive.len();
    app.emit("instance-progress", serde_json::json!({"stage":"extracting","name":instance_name,"percent":20,"message":format!("Extracting {} files...", total)})).ok();
    
    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let name = entry.name().to_string();
        
        // Skip config files we already processed
        if name == "instance.cfg" || name == "mmc-pack.json" {
            continue;
        }
        
        // Map Prism folders to our structure
        let dest_name = if name.starts_with("minecraft/") {
            name["minecraft/".len()..].to_string()
        } else {
            name.clone()
        };
        
        if dest_name.is_empty() {
            continue;
        }
        
        let out_path = dest_dir.join(&dest_name);
        
        if entry.is_dir() {
            std::fs::create_dir_all(&out_path).ok();
        } else {
            if let Some(p) = out_path.parent() {
                std::fs::create_dir_all(p).ok();
            }
            let mut outf = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut outf).map_err(|e| e.to_string())?;
        }
        
        if i % 20 == 0 {
            let pct = 20 + (i as u64 * 50) / total.max(1) as u64;
            app.emit("instance-progress", serde_json::json!({"stage":"extracting","name":instance_name,"percent":pct,"message":format!("Extracted {}/{}", i, total)})).ok();
        }
    }
    
    // Collect mod list
    let mut mods = vec![];
    let mods_dir = dest_dir.join("mods");
    if mods_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&mods_dir) {
            for entry in entries.flatten() {
                let fname = entry.file_name().to_string_lossy().to_string();
                if fname.ends_with(".jar") {
                    mods.push(InstanceMod {
                        id: fname.clone(),
                        name: fname.trim_end_matches(".jar").to_string(),
                        version: "imported".to_string(),
                        source: "prismlauncher".to_string(),
                        enabled: true,
                    });
                }
            }
        }
    }
    
    let instance = Instance {
        id: new_id,
        name: instance_name.clone(),
        description: "Imported from Prism Launcher".to_string(),
        mc_version,
        loader,
        loader_version,
        min_ram,
        max_ram,
        java_path: String::new(),
        custom_jvm_args: String::new(),
        play_time_minutes: 0,
        last_played: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        icon: None,
        color: Some("#3B82F6".to_string()),
        mods,
    };
    
    save_instance(&instance)?;
    app.emit("instance-progress", serde_json::json!({"stage":"done","name":instance_name,"percent":100,"message":"Prism instance imported!"})).ok();
    
    Ok(instance)
}

/// Detect and list available Prism Launcher instances
#[tauri::command]
pub async fn detect_prismlauncher_instances() -> Result<Vec<serde_json::Value>, String> {
    let mut instances = vec![];
    
    // Common Prism Launcher data directories
    let prism_dirs = vec![
        dirs_next::data_dir().map(|d| d.join("PrismLauncher")),
        dirs_next::home_dir().map(|d| d.join("PrismLauncher")),
        dirs_next::data_local_dir().map(|d| d.join("PrismLauncher")),
    ];
    
    for prism_dir_opt in prism_dirs {
        if let Some(prism_dir) = prism_dir_opt {
            let instances_dir_prism = prism_dir.join("instances");
            if instances_dir_prism.exists() {
                if let Ok(entries) = std::fs::read_dir(&instances_dir_prism) {
                    for entry in entries.flatten() {
                        if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                            let instance_dir = entry.path();
                            let instance_name = entry.file_name().to_string_lossy().to_string();
                            
                            // Try to read instance.cfg
                            let cfg_path = instance_dir.join("instance.cfg");
                            let mut mc_ver = "Unknown".to_string();
                            let mut loader_name = "Unknown".to_string();
                            
                            if cfg_path.exists() {
                                if let Ok(cfg_data) = std::fs::read_to_string(&cfg_path) {
                                    for line in cfg_data.lines() {
                                        let line = line.trim();
                                        if line.starts_with("IntendedVersion=") {
                                            mc_ver = line.trim_start_matches("IntendedVersion=").trim_matches('"').to_string();
                                        }
                                        if line.starts_with("Loader=") {
                                            loader_name = line.trim_start_matches("Loader=").trim_matches('"').to_string();
                                        }
                                    }
                                }
                            }
                            
                            instances.push(serde_json::json!({
                                "name": instance_name,
                                "path": instance_dir.to_string_lossy().to_string(),
                                "mc_version": mc_ver,
                                "loader": loader_name,
                                "source": "prismlauncher"
                            }));
                        }
                    }
                }
            }
        }
    }
    
    Ok(instances)
}

/// Detect and list available Modrinth App instances
#[tauri::command]
pub async fn detect_modrinth_instances() -> Result<Vec<serde_json::Value>, String> {
    let mut instances = vec![];
    
    // Modrinth App stores instances in %APPDATA%/com.modrinth.mod/appdata/instances
    let modrinth_dir = dirs_next::data_dir()
        .map(|d| d.join("com.modrinth.mod").join("appdata").join("instances"));
    
    if let Some(instances_dir_mr) = modrinth_dir {
        if instances_dir_mr.exists() {
            if let Ok(entries) = std::fs::read_dir(&instances_dir_mr) {
                for entry in entries.flatten() {
                    if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                        let instance_dir = entry.path();
                        let instance_name = entry.file_name().to_string_lossy().to_string();
                        
                        // Try to read modrinth.index.json or pack.json
                        let index_path = instance_dir.join("modrinth.index.json");
                        let mut mc_ver = "Unknown".to_string();
                        let mut loader_name = "Unknown".to_string();
                        
                        if index_path.exists() {
                            if let Ok(index_data) = std::fs::read_to_string(&index_path) {
                                if let Ok(index_json) = serde_json::from_str::<serde_json::Value>(&index_data) {
                                    if let Some(minecraft) = index_json["dependencies"]["minecraft"].as_str() {
                                        mc_ver = minecraft.to_string();
                                    }
                                    if index_json["dependencies"]["fabric-loader"].is_string() {
                                        loader_name = "Fabric".to_string();
                                    } else if index_json["dependencies"]["forge"].is_string() {
                                        loader_name = "Forge".to_string();
                                    } else if index_json["dependencies"]["neoforge"].is_string() {
                                        loader_name = "NeoForge".to_string();
                                    } else if index_json["dependencies"]["quilt-loader"].is_string() {
                                        loader_name = "Quilt".to_string();
                                    }
                                }
                            }
                        }
                        
                        instances.push(serde_json::json!({
                            "name": instance_name,
                            "path": instance_dir.to_string_lossy().to_string(),
                            "mc_version": mc_ver,
                            "loader": loader_name,
                            "source": "modrinth"
                        }));
                    }
                }
            }
        }
    }
    
    Ok(instances)
}

#[tauri::command]
pub async fn backup_instance(app: tauri::AppHandle, id: String) -> Result<String, String> {
    let inst = load_instance(&id).ok_or("Instance not found")?;
    let ts = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let bdir = { let mut p = mc_base_dir(); p.push("backups"); std::fs::create_dir_all(&p).ok(); p };
    let dest = bdir.join(format!("{}_{}.zip", inst.name.replace(' ', "_"), ts));
    export_instance_zip(app, id, dest.to_string_lossy().to_string()).await
}

#[tauri::command]
pub async fn list_backups() -> Result<Vec<serde_json::Value>, String> {
    let bdir = { let mut p = mc_base_dir(); p.push("backups"); p };
    let mut result = vec![];
    if let Ok(entries) = std::fs::read_dir(&bdir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let modified = entry.metadata().ok().and_then(|m| m.modified().ok()).and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map(|d| d.as_secs()).unwrap_or(0);
            result.push(serde_json::json!({"name":name,"path":entry.path().to_string_lossy(),"size_bytes":size,"modified":modified}));
        }
    }
    result.sort_by(|a, b| b["modified"].as_u64().cmp(&a["modified"].as_u64()));
    Ok(result)
}

/// List screenshots from an instance's .minecraft/screenshot folder
#[tauri::command]
pub fn list_screenshots(id: String) -> Result<Vec<String>, String> {
    let _inst = load_instance(&id).ok_or("Instance not found")?;
    let inst_dir = instances_dir().join(&id);
    let screenshot_dir = inst_dir.join(".minecraft").join("screenshots");
    
    if !screenshot_dir.exists() {
        return Ok(vec![]);
    }
    
    let mut result = vec![];
    if let Ok(entries) = std::fs::read_dir(&screenshot_dir) {
        for entry in entries.flatten() {
            let ext = entry.path().extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
            if ext == "png" || ext == "jpg" || ext == "jpeg" {
                result.push(entry.path().to_string_lossy().to_string());
            }
        }
    }
    result.sort();
    Ok(result)
}
