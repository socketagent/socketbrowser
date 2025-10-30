/**
 * Authentication UI Module
 * Handles socketagent.id authentication
 */

import * as api from './tauri-api.js';
import * as ui from './ui.js';
import { saveAuthTokens, clearAuthTokens, getState } from './main.js';

let authState = {
    isLoggedIn: false,
    user: null
};

// ============================================================================
// INITIALIZATION
// ============================================================================

export async function initAuthUI() {
    console.log('🔐 Initializing auth UI...');

    // Check if user is logged in
    await checkAuthStatus();

    // Render initial UI
    await renderAuthUI();

    console.log('✅ Auth UI initialized');
}

async function checkAuthStatus() {
    const state = getState();

    if (state.accessToken) {
        try {
            const result = await api.auth.getUser(state.accessToken);
            if (result.success && result.user) {
                authState.isLoggedIn = true;
                authState.user = result.user;
            }
        } catch (error) {
            console.warn('Failed to verify auth status:', error);
            authState.isLoggedIn = false;
            authState.user = null;
        }
    }
}

// ============================================================================
// UI RENDERING
// ============================================================================

async function renderAuthUI() {
    const container = document.getElementById('auth-content');

    if (!container) return;

    if (!authState.isLoggedIn) {
        container.innerHTML = renderLoginForm();
    } else {
        container.innerHTML = renderUserDashboard();
    }

    // Attach event listeners
    attachAuthEventListeners();
}

function renderLoginForm() {
    return `
        <div class="auth-forms">
            <div class="form-tabs mb-3">
                <button id="tab-login" class="tab-btn active">Sign In</button>
                <button id="tab-register" class="tab-btn">Sign Up</button>
            </div>

            <!-- Login Form -->
            <form id="auth-form-login" style="display: block;">
                <div class="form-group">
                    <label>Username</label>
                    <input
                        type="text"
                        id="login-username"
                        placeholder="Enter username"
                        required
                        autocomplete="username"
                    >
                </div>

                <div class="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        id="login-password"
                        placeholder="Enter password"
                        required
                        autocomplete="current-password"
                    >
                </div>

                <button type="submit" class="btn btn-full">
                    Sign In
                </button>
            </form>

            <!-- Register Form -->
            <form id="auth-form-register" style="display: none;">
                <div class="form-group">
                    <label>Username</label>
                    <input
                        type="text"
                        id="register-username"
                        placeholder="Choose username"
                        required
                        autocomplete="username"
                    >
                </div>

                <div class="form-group">
                    <label>Email (optional)</label>
                    <input
                        type="email"
                        id="register-email"
                        placeholder="your@email.com"
                        autocomplete="email"
                    >
                </div>

                <div class="form-group">
                    <label>Password</label>
                    <input
                        type="password"
                        id="register-password"
                        placeholder="Choose password"
                        required
                        autocomplete="new-password"
                    >
                </div>

                <div class="form-group">
                    <label>Confirm Password</label>
                    <input
                        type="password"
                        id="register-password-confirm"
                        placeholder="Confirm password"
                        required
                        autocomplete="new-password"
                    >
                </div>

                <button type="submit" class="btn btn-full">
                    Create Account
                </button>
            </form>

            <div class="auth-info mt-3">
                <p class="text-secondary text-center" style="font-size: 12px;">
                    Authentication powered by <a href="#" id="link-socketagent-id">socketagent.id</a>
                </p>
            </div>
        </div>

        <style>
        .form-tabs {
            display: flex;
            gap: 8px;
            border-bottom: 1px solid var(--border);
        }

        .tab-btn {
            flex: 1;
            padding: 12px;
            background: none;
            border: none;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            font-weight: 600;
            color: var(--text-secondary);
            transition: all 0.2s;
        }

        .tab-btn.active {
            color: var(--primary);
            border-bottom-color: var(--primary);
        }

        .tab-btn:hover {
            color: var(--text-primary);
        }
        </style>
    `;
}

function renderUserDashboard() {
    const user = authState.user;

    return `
        <div class="auth-dashboard">
            <div class="user-info mb-3">
                <h3>${user.username}</h3>
                ${user.email ? `<p class="text-secondary">${user.email}</p>` : ''}
                <p class="text-secondary" style="font-size: 12px;">
                    Member since ${new Date(user.created_at).toLocaleDateString()}
                </p>
            </div>

            <div class="user-stats mb-3">
                <div class="stat-card">
                    <div class="stat-label">Render Credits</div>
                    <div class="stat-value">Check account</div>
                </div>
            </div>

            <button id="auth-btn-refresh" class="btn btn-secondary btn-full mb-2">
                Refresh Session
            </button>

            <button id="auth-btn-logout" class="btn btn-danger btn-full">
                Sign Out
            </button>
        </div>

        <style>
        .user-info h3 {
            margin-bottom: 4px;
        }

        .user-stats {
            display: grid;
            gap: 12px;
        }

        .stat-card {
            padding: 16px;
            background: var(--bg-tertiary);
            border-radius: 8px;
        }

        .stat-label {
            font-size: 12px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 4px;
        }

        .stat-value {
            font-size: 24px;
            font-weight: 700;
            color: var(--text-primary);
        }
        </style>
    `;
}

// ============================================================================
// EVENT HANDLERS
// ============================================================================

function attachAuthEventListeners() {
    // Tab switching
    document.getElementById('tab-login')?.addEventListener('click', () => {
        document.getElementById('auth-form-login').style.display = 'block';
        document.getElementById('auth-form-register').style.display = 'none';
        document.getElementById('tab-login').classList.add('active');
        document.getElementById('tab-register').classList.remove('active');
    });

    document.getElementById('tab-register')?.addEventListener('click', () => {
        document.getElementById('auth-form-login').style.display = 'none';
        document.getElementById('auth-form-register').style.display = 'block';
        document.getElementById('tab-login').classList.remove('active');
        document.getElementById('tab-register').classList.add('active');
    });

    // Forms
    document.getElementById('auth-form-login')?.addEventListener('submit', handleLogin);
    document.getElementById('auth-form-register')?.addEventListener('submit', handleRegister);

    // Dashboard buttons
    document.getElementById('auth-btn-refresh')?.addEventListener('click', handleRefresh);
    document.getElementById('auth-btn-logout')?.addEventListener('click', handleLogout);

    // External link
    document.getElementById('link-socketagent-id')?.addEventListener('click', (e) => {
        e.preventDefault();
        api.system.openExternal('https://socketagent.io');
    });
}

async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('login-username')?.value;
    const password = document.getElementById('login-password')?.value;

    if (!username || !password) {
        ui.showToast('Please fill in all fields', 'warning');
        return;
    }

    try {
        const result = await api.auth.login(username, password);

        if (!result.success) {
            throw new Error(result.error || 'Login failed');
        }

        await saveAuthTokens(result.access_token, result.refresh_token);

        // Get user info
        const userResult = await api.auth.getUser(result.access_token);
        if (userResult.success && userResult.user) {
            authState.isLoggedIn = true;
            authState.user = userResult.user;
        }

        await renderAuthUI();

        ui.showToast(`Welcome back, ${username}!`, 'success');
    } catch (error) {
        ui.showToast(`Login failed: ${error.message}`, 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('register-username')?.value;
    const email = document.getElementById('register-email')?.value;
    const password = document.getElementById('register-password')?.value;
    const passwordConfirm = document.getElementById('register-password-confirm')?.value;

    if (!username || !password) {
        ui.showToast('Please fill in all required fields', 'warning');
        return;
    }

    if (password !== passwordConfirm) {
        ui.showToast('Passwords do not match', 'error');
        return;
    }

    try {
        const result = await api.auth.register(username, email || null, password);

        if (!result.success) {
            throw new Error(result.error || 'Registration failed');
        }

        ui.showToast('Account created! Please sign in.', 'success');

        // Switch to login tab
        document.getElementById('tab-login')?.click();

        // Pre-fill username
        const loginUsername = document.getElementById('login-username');
        if (loginUsername) {
            loginUsername.value = username;
        }
    } catch (error) {
        ui.showToast(`Registration failed: ${error.message}`, 'error');
    }
}

async function handleRefresh() {
    const state = getState();

    if (!state.refreshToken) {
        ui.showToast('No refresh token available', 'error');
        return;
    }

    try {
        const result = await api.auth.refresh(state.refreshToken);

        if (!result.success) {
            throw new Error(result.error || 'Failed to refresh session');
        }

        await saveAuthTokens(result.access_token, result.refresh_token);

        ui.showToast('Session refreshed', 'success');
    } catch (error) {
        ui.showToast(`Failed to refresh session: ${error.message}`, 'error');
        await handleLogout();
    }
}

async function handleLogout() {
    const state = getState();

    try {
        if (state.refreshToken) {
            await api.auth.logout(state.refreshToken);
        }

        await clearAuthTokens();

        authState.isLoggedIn = false;
        authState.user = null;

        await renderAuthUI();

        ui.showToast('Signed out successfully', 'success');
    } catch (error) {
        ui.showToast(`Logout failed: ${error.message}`, 'error');
    }
}
