// Socket Browser - Tauri Main Application
// Complete rewrite from Electron to Tauri/Rust

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

mod api;
mod auth;
mod llm;
mod storage;
mod wallet;

use api::{call_api, discover_socket_agent, ApiCallResponse, DiscoveryResponse};
use auth::{AuthClient, AuthResponse};
use llm::{RenderClient, RenderResponse};
use storage::Storage;
use wallet::{SolanaWallet, WalletResponse};

// Application state
struct AppState {
    storage: Mutex<Option<Storage>>,
    wallet: SolanaWallet,
    auth_client: AuthClient,
    render_client: RenderClient,
}

// ============================================================================
// AUTHENTICATION COMMANDS
// ============================================================================

#[tauri::command]
async fn auth_register(
    username: String,
    email: Option<String>,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    let user_id = state
        .auth_client
        .register(username, email, password)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthResponse {
        success: true,
        user_id: Some(user_id),
        access_token: None,
        refresh_token: None,
        expires_in: None,
        user: None,
        error: None,
    })
}

#[tauri::command]
async fn auth_login(
    username: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    let login_response = state
        .auth_client
        .login(username, password)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthResponse {
        success: true,
        user_id: None,
        access_token: Some(login_response.access_token),
        refresh_token: Some(login_response.refresh_token),
        expires_in: Some(login_response.expires_in),
        user: None,
        error: None,
    })
}

#[tauri::command]
async fn auth_get_user(
    access_token: String,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    let user_info = state
        .auth_client
        .get_user(&access_token)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthResponse {
        success: true,
        user_id: None,
        access_token: None,
        refresh_token: None,
        expires_in: None,
        user: Some(user_info),
        error: None,
    })
}

#[tauri::command]
async fn auth_refresh(
    refresh_token: String,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    let refresh_response = state
        .auth_client
        .refresh(refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthResponse {
        success: true,
        user_id: None,
        access_token: Some(refresh_response.access_token),
        refresh_token: Some(refresh_response.refresh_token),
        expires_in: Some(refresh_response.expires_in),
        user: None,
        error: None,
    })
}

#[tauri::command]
async fn auth_logout(
    refresh_token: String,
    state: State<'_, AppState>,
) -> Result<AuthResponse, String> {
    state
        .auth_client
        .logout(refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    Ok(AuthResponse {
        success: true,
        user_id: None,
        access_token: None,
        refresh_token: None,
        expires_in: None,
        user: None,
        error: None,
    })
}

// ============================================================================
// API DISCOVERY AND CLIENT COMMANDS
// ============================================================================

#[tauri::command]
async fn discover_socket_agent_cmd(url: String) -> Result<DiscoveryResponse, String> {
    match discover_socket_agent(&url).await {
        Ok(descriptor) => Ok(DiscoveryResponse {
            success: true,
            descriptor: Some(descriptor),
            error: None,
        }),
        Err(e) => Ok(DiscoveryResponse {
            success: false,
            descriptor: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
async fn call_api_cmd(
    base_url: String,
    endpoint_id: String,
    params: HashMap<String, serde_json::Value>,
) -> Result<ApiCallResponse, String> {
    match call_api(&base_url, &endpoint_id, params, None).await {
        Ok(data) => Ok(ApiCallResponse {
            success: true,
            data: Some(data),
            status_code: Some(200),
            error: None,
        }),
        Err(e) => Ok(ApiCallResponse {
            success: false,
            data: None,
            status_code: None,
            error: Some(e.to_string()),
        }),
    }
}

// ============================================================================
// RENDER/UI GENERATION COMMANDS
// ============================================================================

#[tauri::command]
async fn generate_website(
    access_token: String,
    descriptor: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<RenderResponse, String> {
    // Parse descriptor
    let descriptor: api::discovery::SocketAgentDescriptor =
        serde_json::from_value(descriptor).map_err(|e| e.to_string())?;

    match state
        .render_client
        .generate(&access_token, descriptor, None)
        .await
    {
        Ok(response) => Ok(RenderResponse {
            success: true,
            html: Some(response.html),
            credits_remaining: Some(response.credits_remaining),
            error: None,
        }),
        Err(e) => Ok(RenderResponse {
            success: false,
            html: None,
            credits_remaining: None,
            error: Some(e.to_string()),
        }),
    }
}

// ============================================================================
// WALLET COMMANDS
// ============================================================================

#[tauri::command]
async fn wallet_generate_new(
    password: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<WalletResponse, String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    state
        .wallet
        .generate_new(&password, storage)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn wallet_import_mnemonic(
    mnemonic: String,
    password: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<WalletResponse, String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    state
        .wallet
        .import_from_mnemonic(&mnemonic, &password, storage)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn wallet_import_private_key(
    private_key: String,
    password: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<WalletResponse, String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    state
        .wallet
        .import_from_private_key(&private_key, &password, storage)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn wallet_unlock(
    password: String,
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<WalletResponse, String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    state
        .wallet
        .unlock(&password, storage)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn wallet_lock(state: State<'_, AppState>) -> Result<WalletResponse, String> {
    state.wallet.lock();
    Ok(WalletResponse {
        success: true,
        address: None,
        mnemonic: None,
        balance: None,
        private_key: None,
        has_wallet: None,
        is_unlocked: Some(false),
        error: None,
    })
}

#[tauri::command]
fn wallet_get_address(state: State<'_, AppState>) -> Result<WalletResponse, String> {
    match state.wallet.get_address() {
        Ok(address) => Ok(WalletResponse {
            success: true,
            address: Some(address),
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: None,
        }),
        Err(e) => Ok(WalletResponse {
            success: false,
            address: None,
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
async fn wallet_get_balance(state: State<'_, AppState>) -> Result<WalletResponse, String> {
    match state.wallet.get_balance() {
        Ok(balance) => Ok(WalletResponse {
            success: true,
            address: None,
            mnemonic: None,
            balance: Some(balance),
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: None,
        }),
        Err(e) => Ok(WalletResponse {
            success: false,
            address: None,
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
fn wallet_export_private_key(state: State<'_, AppState>) -> Result<WalletResponse, String> {
    match state.wallet.export_private_key() {
        Ok(private_key) => Ok(WalletResponse {
            success: true,
            address: None,
            mnemonic: None,
            balance: None,
            private_key: Some(private_key),
            has_wallet: None,
            is_unlocked: None,
            error: None,
        }),
        Err(e) => Ok(WalletResponse {
            success: false,
            address: None,
            mnemonic: None,
            balance: None,
            private_key: None,
            has_wallet: None,
            is_unlocked: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
fn wallet_has_wallet(
    state: State<'_, AppState>,
    app_handle: tauri::AppHandle,
) -> Result<WalletResponse, String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    let has_wallet = state.wallet.has_wallet(storage);

    Ok(WalletResponse {
        success: true,
        address: None,
        mnemonic: None,
        balance: None,
        private_key: None,
        has_wallet: Some(has_wallet),
        is_unlocked: None,
        error: None,
    })
}

#[tauri::command]
fn wallet_is_unlocked(state: State<'_, AppState>) -> Result<WalletResponse, String> {
    let is_unlocked = state.wallet.is_unlocked();

    Ok(WalletResponse {
        success: true,
        address: None,
        mnemonic: None,
        balance: None,
        private_key: None,
        has_wallet: None,
        is_unlocked: Some(is_unlocked),
        error: None,
    })
}

// ============================================================================
// STORAGE COMMANDS
// ============================================================================

#[tauri::command]
fn get_storage(key: String, state: State<'_, AppState>) -> Result<Option<serde_json::Value>, String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    storage.get(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_storage(
    key: String,
    value: serde_json::Value,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let storage_guard = state.storage.lock().unwrap();
    let storage = storage_guard.as_ref().ok_or("Storage not initialized")?;

    storage.set(key, value).map_err(|e| e.to_string())
}

// ============================================================================
// MAIN APPLICATION
// ============================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize storage
            let storage = Storage::new(app.handle())?;

            // Initialize application state
            let app_state = AppState {
                storage: Mutex::new(Some(storage)),
                wallet: SolanaWallet::new(),
                auth_client: AuthClient::new(),
                render_client: RenderClient::new(),
            };

            app.manage(app_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth commands
            auth_register,
            auth_login,
            auth_get_user,
            auth_refresh,
            auth_logout,
            // API commands
            discover_socket_agent_cmd,
            call_api_cmd,
            generate_website,
            // Wallet commands
            wallet_generate_new,
            wallet_import_mnemonic,
            wallet_import_private_key,
            wallet_unlock,
            wallet_lock,
            wallet_get_address,
            wallet_get_balance,
            wallet_export_private_key,
            wallet_has_wallet,
            wallet_is_unlocked,
            // Storage commands
            get_storage,
            set_storage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
