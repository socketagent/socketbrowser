// Authentication UI Handler for Socket Browser
// Integrates with socketagent.id for user authentication and credit management

const API_BASE_URL = 'https://socketagent.io/v1';

// State
let currentUser = null;
let accessToken = null;

// Initialize auth UI
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
});

async function initAuth() {
    // Load stored token
    const stored = await window.electronAPI.getStorage('auth');
    if (stored && stored.accessToken) {
        accessToken = stored.accessToken;
        await loadUserInfo();
    } else {
        updateAccountButton(null);
    }

    // Account button click
    document.getElementById('account-btn').addEventListener('click', () => {
        openAccountModal();
    });

    // Modal close
    document.getElementById('account-close-btn').addEventListener('click', () => {
        closeAccountModal();
    });

    // Login/Register choice
    document.getElementById('show-login-btn').addEventListener('click', () => {
        showScreen('account-login');
    });

    document.getElementById('show-register-btn').addEventListener('click', () => {
        showScreen('account-register');
    });

    // Login flow
    document.getElementById('login-back-btn').addEventListener('click', () => {
        showScreen('account-choice');
    });

    document.getElementById('login-submit-btn').addEventListener('click', async () => {
        await handleLogin();
    });

    // Register flow
    document.getElementById('register-back-btn').addEventListener('click', () => {
        showScreen('account-choice');
    });

    document.getElementById('register-submit-btn').addEventListener('click', async () => {
        await handleRegister();
    });

    // Main account view
    document.getElementById('refresh-credits-btn').addEventListener('click', async () => {
        await refreshCredits();
    });

    document.getElementById('buy-credits-btn').addEventListener('click', () => {
        // Open dashboard in external browser
        window.electronAPI.openExternal('https://socketagent.io/dashboard.html');
    });

    document.getElementById('logout-btn').addEventListener('click', async () => {
        await handleLogout();
    });

    // Enter key handlers
    document.getElementById('login-password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });

    document.getElementById('register-password-confirm').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleRegister();
    });
}

function openAccountModal() {
    const modal = document.getElementById('account-modal');
    modal.classList.remove('hidden');

    if (accessToken) {
        showScreen('account-main');
    } else {
        showScreen('account-choice');
    }
}

function closeAccountModal() {
    const modal = document.getElementById('account-modal');
    modal.classList.add('hidden');
}

function showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('#account-modal .wallet-screen').forEach(screen => {
        screen.classList.add('hidden');
    });

    // Show requested screen
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.remove('hidden');
    }

    // Clear status
    hideStatus();
}

function showStatus(message, isError = false) {
    const status = document.getElementById('account-status');
    status.textContent = message;
    status.classList.remove('hidden');
    status.style.color = isError ? '#ff6b6b' : '#00ff41';
}

function hideStatus() {
    const status = document.getElementById('account-status');
    status.classList.add('hidden');
}

async function handleLogin() {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;

    if (!username || !password) {
        showStatus('Please enter username and password', true);
        return;
    }

    showStatus('Logging in...');

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Save token
        accessToken = data.access_token;
        await window.electronAPI.setStorage('auth', {
            accessToken: data.access_token,
            refreshToken: data.refresh_token
        });

        // Load user info
        await loadUserInfo();

        showStatus('Login successful!');
        setTimeout(() => {
            showScreen('account-main');
        }, 500);

    } catch (error) {
        console.error('Login error:', error);
        showStatus(error.message, true);
    }
}

async function handleRegister() {
    const username = document.getElementById('register-username').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const passwordConfirm = document.getElementById('register-password-confirm').value;

    if (!username || !password) {
        showStatus('Please enter username and password', true);
        return;
    }

    if (password !== passwordConfirm) {
        showStatus('Passwords do not match', true);
        return;
    }

    showStatus('Creating account...');

    try {
        // Register user
        const registerResponse = await fetch(`${API_BASE_URL}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email: email || undefined, password })
        });

        const registerData = await registerResponse.json();

        if (!registerResponse.ok) {
            throw new Error(registerData.error || 'Registration failed');
        }

        showStatus('Account created! Logging in...');

        // Auto-login
        const loginResponse = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const loginData = await loginResponse.json();

        if (!loginResponse.ok) {
            throw new Error('Registration succeeded but login failed. Please login manually.');
        }

        // Save token
        accessToken = loginData.access_token;
        await window.electronAPI.setStorage('auth', {
            accessToken: loginData.access_token,
            refreshToken: loginData.refresh_token
        });

        // Load user info
        await loadUserInfo();

        showStatus('Registration successful!');
        setTimeout(() => {
            showScreen('account-main');
        }, 500);

    } catch (error) {
        console.error('Registration error:', error);
        showStatus(error.message, true);
    }
}

async function loadUserInfo() {
    if (!accessToken) return;

    try {
        const response = await fetch(`${API_BASE_URL}/me`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load user info');
        }

        currentUser = data;
        updateAccountUI(data);
        updateAccountButton(data);

    } catch (error) {
        console.error('Error loading user info:', error);
        // Token might be expired
        accessToken = null;
        currentUser = null;
        await window.electronAPI.setStorage('auth', null);
        updateAccountButton(null);
    }
}

function updateAccountUI(user) {
    document.getElementById('account-username-display').textContent = user.username;
    document.getElementById('account-email-display').textContent = user.email || 'Not set';
    document.getElementById('account-credits-display').textContent = `${user.render_credits || 0} credits`;
}

function updateAccountButton(user) {
    const usernameElement = document.getElementById('account-username');
    if (user) {
        usernameElement.textContent = user.username;
    } else {
        usernameElement.textContent = 'Login';
    }
}

async function refreshCredits() {
    if (!accessToken) return;

    showStatus('Refreshing...');

    try {
        const response = await fetch(`${API_BASE_URL}/credits/balance`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to refresh credits');
        }

        // Update UI
        document.getElementById('account-credits-display').textContent = `${data.render_credits} credits`;

        // Update button
        if (currentUser) {
            currentUser.render_credits = data.render_credits;
            updateAccountButton(currentUser);
        }

        hideStatus();

    } catch (error) {
        console.error('Error refreshing credits:', error);
        showStatus('Failed to refresh credits', true);
    }
}

async function handleLogout() {
    accessToken = null;
    currentUser = null;
    await window.electronAPI.setStorage('auth', null);
    updateAccountButton(null);
    showScreen('account-choice');
    closeAccountModal();
}

// Export for use in renderer
window.authAPI = {
    getAccessToken: () => accessToken,
    getCurrentUser: () => currentUser,
    isLoggedIn: () => !!accessToken,
    refreshCredits: refreshCredits
};
