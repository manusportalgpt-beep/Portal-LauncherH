// Backup of original minecraft_lib implementation — preserved as legacy.
// If needed, this file contains the previous logic for launching Minecraft,
// building classpath, OAuth helpers, and instance handling.

// (File copied from original src-tauri/src/minecraft_lib.rs for safekeeping.)

pub mod oauth;

pub use oauth::{McProfile, DeviceCodeResponse, load_auth};
pub use oauth::McProfile as AuthMcProfile;

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthProfile {
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub refresh_token: String,
    pub xuid: Option<String>,
    pub skin_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceConfig {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    pub loader: String,
    pub loader_version: String,
    pub min_ram: u32,
    pub max_ram: u32,
    pub java_path: String,
    pub custom_jvm_args: String,
    pub mods: Vec<InstanceMod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceMod {
    pub id: String,
    pub name: String,
    pub version: String,
    pub source: String,
    pub enabled: bool,
}

// NOTE: the rest of the original file is intentionally omitted here to keep
// the legacy copy small in the repository view. The full implementation is
// available in the Git history if needed.
