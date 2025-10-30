/**
 * Tauri API Wrapper for Socket Browser
 * Clean interface to all Rust backend commands
 */

import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';

// ============================================================================
// AUTHENTICATION API
// ============================================================================

export const auth = {
    async register(username, email, password) {
        return await invoke('auth_register', { username, email, password });
    },

    async login(username, password) {
        return await invoke('auth_login', { username, password });
    },

    async getUser(accessToken) {
        return await invoke('auth_get_user', { accessToken });
    },

    async refresh(refreshToken) {
        return await invoke('auth_refresh', { refreshToken });
    },

    async logout(refreshToken) {
        return await invoke('auth_logout', { refreshToken });
    }
};

// ============================================================================
// SOCKET AGENT API
// ============================================================================

export const socketAgent = {
    async discover(url) {
        return await invoke('discover_socket_agent_cmd', { url });
    },

    async callAPI(baseUrl, endpointId, params) {
        return await invoke('call_api_cmd', { baseUrl, endpointId, params });
    },

    async generateWebsite(accessToken, descriptor) {
        return await invoke('generate_website', { accessToken, descriptor });
    }
};

// ============================================================================
// WALLET API
// ============================================================================

export const wallet = {
    async generateNew(password) {
        return await invoke('wallet_generate_new', { password });
    },

    async importMnemonic(mnemonic, password) {
        return await invoke('wallet_import_mnemonic', { mnemonic, password });
    },

    async importPrivateKey(privateKey, password) {
        return await invoke('wallet_import_private_key', { privateKey, password });
    },

    async unlock(password) {
        return await invoke('wallet_unlock', { password });
    },

    async lock() {
        return await invoke('wallet_lock');
    },

    async getAddress() {
        return await invoke('wallet_get_address');
    },

    async getBalance() {
        return await invoke('wallet_get_balance');
    },

    async exportPrivateKey() {
        return await invoke('wallet_export_private_key');
    },

    async hasWallet() {
        return await invoke('wallet_has_wallet');
    },

    async isUnlocked() {
        return await invoke('wallet_is_unlocked');
    }
};

// ============================================================================
// STORAGE API
// ============================================================================

export const storage = {
    async get(key) {
        return await invoke('get_storage', { key });
    },

    async set(key, value) {
        return await invoke('set_storage', { key, value });
    }
};

// ============================================================================
// SYSTEM API
// ============================================================================

export const system = {
    async openExternal(url) {
        await open(url);
    }
};
