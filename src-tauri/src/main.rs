#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

pub mod api;
pub mod commands;
pub mod models;
pub mod services;
pub mod utils;

use std::sync::Arc;
use tokio::sync::RwLock;
use tauri::generate_handler;

pub struct AppState {
  pub pending_auth: Arc<RwLock<Option<String>>>
}

impl AppState {
  pub fn new() -> Self {
    Self {
      pending_auth: Arc::new(RwLock::new(None))
    }
  }
}

fn main() {
  tauri::Builder::default()
    .plugin(tauri_plugin_shell::init())
    .manage(AppState::new())
    .invoke_handler(generate_handler![
      commands::auth::start_device_code_flow,
      commands::auth::poll_for_token,
      commands::instances::get_instances,
      commands::minecraft::launch_instance
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
