#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

pub mod api;
pub mod commands;
pub mod models;
pub mod services;
pub mod utils;
pub mod minecraft_lib;

pub use services::cloud_sync::CloudSyncService;

use std::sync::Arc;
use std::collections::HashMap;
use tokio::sync::RwLock;

pub struct AppState {
    pub pending_auth:  Arc<RwLock<Option<String>>>,
    pub auth_results:  Arc<RwLock<HashMap<String, Result<minecraft_lib::AuthMcProfile, String>>>>,
}
impl AppState {
    pub fn new() -> Self {
        Self {
            pending_auth: Arc::new(RwLock::new(None)),
            auth_results: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

fn main() {
    env_logger::init();
    
    // Create ALL required directories on startup
    commands::dirs::ensure_all_dirs();
    
    let app_state = AppState::new();
    
    let _polling_handle = std::thread::spawn(move || {
        let rt = tokio::runtime::Runtime::new().unwrap();
        rt.block_on(async {
            // Polling is handled per-request
        });
    });
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_oauth::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Minecraft OAuth через minecraft_lib::oauth
            minecraft_lib::oauth::start_device_code_flow,
            minecraft_lib::oauth::poll_for_token,
            minecraft_lib::oauth::refresh_token,
            minecraft_lib::oauth::auto_refresh_if_needed,
            minecraft_lib::oauth::get_cached_profile,
            minecraft_lib::oauth::is_token_expired,
            // Auth save
            commands::auth_save::save_auth_info,
            commands::auth_save::get_auth_info_cmd,
            commands::auth_save::debug_auth_info,
            // Cloud sync
            commands::auth::save_auth_to_cloud,
            commands::auth::load_auth_from_cloud,
            commands::auth::sync_auth_cloud,
            commands::auth::get_cloud_sync_status,
            commands::auth::set_cloud_provider,
            commands::auth::delete_cloud_auth,
            commands::auth::clear_auth,
            // Token manager
            commands::token_manager::store_tokens,
            commands::token_manager::get_stored_refresh_token,
            commands::token_manager::delete_stored_tokens,
            // Instances
            commands::instances::get_instances,
            commands::instances::create_instance,
            commands::instances::update_instance,
            commands::instances::delete_instance,
            commands::instances::ensure_instance,
            commands::instances::duplicate_instance,
            commands::instances::open_instance_folder,
            commands::instances::export_instance_zip,
            commands::instances::import_instance_zip,
            commands::instances::import_modrinth_pack,
            commands::instances::import_prismlauncher_instance,
            commands::instances::detect_prismlauncher_instances,
            commands::instances::detect_modrinth_instances,
            commands::instances::backup_instance,
            commands::instances::list_backups,
            commands::instances::list_screenshots,
            // Minecraft
            commands::minecraft::launch_instance,
            commands::minecraft::kill_instance,
            commands::minecraft::get_game_logs,
            // Lighty launcher adapter
            commands::launcher::launch_with_lighty,
            commands::launcher::lighty_available,
            // Version manager
            commands::version_manager::get_installed_versions,
            commands::version_manager::get_available_versions,
            commands::version_manager::get_filtered_versions,
            commands::version_manager::download_minecraft_version,
            commands::version_manager::delete_minecraft_version,
            // Loader installer
            commands::loader_installer::install_forge,
            commands::loader_installer::install_fabric,
            commands::loader_installer::install_quilt,
            commands::loader_installer::install_neoforge,
            commands::loader_installer::get_fabric_versions,
            commands::loader_installer::get_forge_versions,
            commands::loader_installer::get_neoforge_versions,
            // Mods
            commands::mods::search_mods,
            commands::mods::install_mod,
            commands::mods::install_curseforge_mod,
            commands::mods::get_instance_mods,
            commands::mods::toggle_mod,
            commands::mods::remove_mod,
            commands::mods::check_mod_updates,
            commands::mods::update_all_mods,
            commands::mods::detect_mod_conflicts,
            commands::mods::check_mod_compatibility,
            // Modrinth
            commands::modrinth::search_modrinth,
            commands::modrinth::get_modrinth_project,
            commands::modrinth::get_modrinth_versions,
            // CurseForge
            commands::curseforge::search_curseforge,
            commands::curseforge::get_curseforge_mod_files,
            commands::curseforge::get_curseforge_file_download_url,
            commands::curseforge::get_curseforge_mod,
            // Skins
            commands::skins::get_current_skin,
            commands::skins::upload_skin,
            commands::skins::upload_skin_bytes,
            // Friends
            commands::friends::get_friends,
            commands::friends::add_friend,
            commands::friends::remove_friend,
            commands::friends::join_friend_world,
            // Chat
            commands::chat::send_message,
            commands::chat::get_messages,
            commands::chat::delete_message,
            commands::chat::mark_messages_read,
            commands::chat::flush_offline_queue,
            // Voice
            commands::voice::start_voice_message_upload,
            commands::voice::list_voice_messages,
            commands::voice::delete_voice_message,
            // WebRTC
            commands::webrtc_signaling::send_offer,
            commands::webrtc_signaling::send_answer,
            commands::webrtc_signaling::poll_signaling,
            commands::webrtc_signaling::send_ice_candidate,
            commands::webrtc_signaling::poll_ice_candidates,
            commands::webrtc_signaling::clear_signaling,
            // Audio
            commands::audio::list_audio_devices,
            // JVM
            commands::jvm::get_java_info,
            commands::jvm::download_java,
            commands::jvm::get_managed_java_versions,
            commands::jvm::download_java_zulu,
            // Files
            commands::files::open_folder,
            commands::files::open_minecraft_folder,
            commands::files::get_minecraft_folder_path,
            commands::files::read_file_bytes,
            commands::files::write_file_bytes,
            commands::files::open_url,
            // Meta cache
            commands::meta_cache::cache_cdn_file,
            commands::meta_cache::get_cached_cdn_file,
            commands::meta_cache::add_feed_item,
            commands::meta_cache::get_feed_items,
            commands::meta_cache::mark_feed_item_read,
            commands::meta_cache::clean_cdn_cache,
            commands::meta_cache::get_cache_stats,
            // Settings
            commands::settings::get_all,
            commands::settings::set_setting,
            commands::settings::save_all_settings,
            commands::settings::get_setting,
            commands::settings::should_show_snapshots,
            commands::settings::get_curseforge_api_key,
            commands::settings::get_relay_server_url,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
