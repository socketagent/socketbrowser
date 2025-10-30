/**
 * Socket Browser - Main Application
 * Modern Tauri-native browser for Socket Agent APIs
 */

import * as api from './tauri-api.js';
import * as ui from './ui.js';
import { initWalletUI } from './wallet-ui.js';
import { initAuthUI } from './auth-ui.js';

// Application State
const state = {
    currentUrl: null,
    descriptor: null,
    history: [],
    historyIndex: -1,
    accessToken: null,
    refreshToken: null,
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function init() {
    console.log('🚀 Socket Browser starting...');

    // Set up event listeners
    setupEventListeners();

    // Initialize sub-modules
    initWalletUI();
    initAuthUI();

    // Load saved auth tokens
    await loadAuthTokens();

    // Show welcome screen
    ui.showWelcome();

    console.log('✅ Socket Browser ready');
}

function setupEventListeners() {
    // Navigation buttons
    ui.onClick('btn-back', handleBack);
    ui.onClick('btn-forward', handleForward);
    ui.onClick('btn-home', handleHome);
    ui.onClick('btn-go', handleGo);

    // URL input - Enter key
    document.getElementById('url-input')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleGo();
        }
    });

    // User controls
    ui.onClick('btn-wallet', () => ui.togglePanel('wallet-panel'));
    ui.onClick('btn-auth', () => ui.togglePanel('auth-panel'));

    // Panel close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const panelId = e.target.dataset.close;
            if (panelId) {
                ui.closePanel(panelId);
            }
        });
    });

    // Error dismiss
    ui.onClick('btn-dismiss-error', ui.hideError);

    // Welcome screen actions
    ui.onClick('btn-setup-wallet', () => ui.openPanel('wallet-panel'));
    ui.onClick('btn-login', () => ui.openPanel('auth-panel'));

    // Example URL links
    document.querySelectorAll('.examples a').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = e.target.dataset.url;
            if (url) {
                ui.setInputValue('url-input', url);
                handleGo();
            }
        });
    });
}

// ============================================================================
// AUTH TOKEN MANAGEMENT
// ============================================================================

async function loadAuthTokens() {
    try {
        const authData = await api.storage.get('auth');
        if (authData) {
            state.accessToken = authData.accessToken;
            state.refreshToken = authData.refreshToken;
            console.log('✅ Auth tokens loaded');
        }
    } catch (error) {
        console.warn('No saved auth tokens');
    }
}

export async function saveAuthTokens(accessToken, refreshToken) {
    state.accessToken = accessToken;
    state.refreshToken = refreshToken;

    await api.storage.set('auth', {
        accessToken,
        refreshToken
    });

    ui.showToast('Logged in successfully', 'success');
}

export async function clearAuthTokens() {
    state.accessToken = null;
    state.refreshToken = null;

    await api.storage.set('auth', null);

    ui.showToast('Logged out', 'success');
}

// ============================================================================
// NAVIGATION
// ============================================================================

async function handleGo() {
    const url = ui.getInputValue('url-input');

    if (!url) {
        ui.showToast('Please enter a URL', 'warning');
        return;
    }

    await navigateTo(url);
}

async function navigateTo(url) {
    try {
        ui.showLoading('Discovering API...');

        // Discover Socket Agent API
        const result = await api.socketAgent.discover(url);

        if (!result.success) {
            throw new Error(result.error || 'Failed to discover API');
        }

        state.descriptor = result.descriptor;
        state.currentUrl = url;

        // Add to history
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push({ url, descriptor: result.descriptor });
        state.historyIndex = state.history.length - 1;

        updateNavigationButtons();

        // Generate UI
        await generateUI(state.descriptor);

    } catch (error) {
        console.error('Navigation error:', error);
        ui.showError(`Failed to load ${url}: ${error.message}`);
    }
}

async function generateUI(descriptor) {
    try {
        ui.showLoading('Generating UI...');

        // Check if we have access token
        if (!state.accessToken) {
            ui.showError('Please sign in to generate UIs. Click the account button to login.');
            return;
        }

        // Generate website using render service
        const result = await api.socketAgent.generateWebsite(state.accessToken, descriptor);

        if (!result.success) {
            throw new Error(result.error || 'Failed to generate UI');
        }

        // Inject generated HTML
        ui.setGeneratedUI(result.html);

        ui.showToast(`UI generated (${result.credits_remaining} credits remaining)`, 'success');

    } catch (error) {
        console.error('UI generation error:', error);

        // Check for auth errors
        if (error.message.includes('Authentication failed')) {
            // Try to refresh token
            if (state.refreshToken) {
                try {
                    const refreshResult = await api.auth.refresh(state.refreshToken);
                    if (refreshResult.success) {
                        await saveAuthTokens(refreshResult.access_token, refreshResult.refresh_token);
                        // Retry generation
                        return await generateUI(descriptor);
                    }
                } catch (refreshError) {
                    await clearAuthTokens();
                    ui.showError('Session expired. Please sign in again.');
                    return;
                }
            }

            ui.showError('Please sign in to generate UIs.');
        } else {
            ui.showError(`Failed to generate UI: ${error.message}`);
        }
    }
}

function handleBack() {
    if (state.historyIndex > 0) {
        state.historyIndex--;
        const entry = state.history[state.historyIndex];
        state.currentUrl = entry.url;
        state.descriptor = entry.descriptor;

        ui.setInputValue('url-input', entry.url);
        generateUI(entry.descriptor);
        updateNavigationButtons();
    }
}

function handleForward() {
    if (state.historyIndex < state.history.length - 1) {
        state.historyIndex++;
        const entry = state.history[state.historyIndex];
        state.currentUrl = entry.url;
        state.descriptor = entry.descriptor;

        ui.setInputValue('url-input', entry.url);
        generateUI(entry.descriptor);
        updateNavigationButtons();
    }
}

function handleHome() {
    state.currentUrl = null;
    state.descriptor = null;
    ui.clearInput('url-input');
    ui.showWelcome();
    updateNavigationButtons();
}

function updateNavigationButtons() {
    const backBtn = document.getElementById('btn-back');
    const forwardBtn = document.getElementById('btn-forward');

    if (backBtn) {
        backBtn.disabled = state.historyIndex <= 0;
    }

    if (forwardBtn) {
        forwardBtn.disabled = state.historyIndex >= state.history.length - 1;
    }
}

// ============================================================================
// EXPORTS (for sub-modules)
// ============================================================================

export function getState() {
    return state;
}

// ============================================================================
// START APPLICATION
// ============================================================================

document.addEventListener('DOMContentLoaded', init);
