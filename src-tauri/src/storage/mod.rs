// Storage module for Socket Browser
// Provides persistent JSON file storage

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

pub struct Storage {
    file_path: PathBuf,
    data: Mutex<HashMap<String, Value>>,
}

impl Storage {
    pub fn new(app_handle: &tauri::AppHandle) -> Result<Self> {
        let app_dir = app_handle
            .path()
            .app_data_dir()
            .context("Failed to get app data directory")?;

        fs::create_dir_all(&app_dir).context("Failed to create app data directory")?;

        let file_path = app_dir.join("wallet-storage.json");

        // Load existing data or create new
        let data = if file_path.exists() {
            let contents = fs::read_to_string(&file_path)
                .context("Failed to read storage file")?;
            serde_json::from_str(&contents)
                .unwrap_or_else(|_| HashMap::new())
        } else {
            HashMap::new()
        };

        Ok(Self {
            file_path,
            data: Mutex::new(data),
        })
    }

    pub fn get(&self, key: &str) -> Result<Option<Value>> {
        let data = self.data.lock().unwrap();
        Ok(data.get(key).cloned())
    }

    pub fn set(&self, key: String, value: Value) -> Result<()> {
        let mut data = self.data.lock().unwrap();
        data.insert(key, value);
        self.save(&data)?;
        Ok(())
    }

    pub fn remove(&self, key: &str) -> Result<()> {
        let mut data = self.data.lock().unwrap();
        data.remove(key);
        self.save(&data)?;
        Ok(())
    }

    fn save(&self, data: &HashMap<String, Value>) -> Result<()> {
        let json = serde_json::to_string_pretty(data)
            .context("Failed to serialize storage")?;
        fs::write(&self.file_path, json)
            .context("Failed to write storage file")?;
        Ok(())
    }
}
