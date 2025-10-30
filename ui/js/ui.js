/**
 * UI Utilities for Socket Browser
 * Toast notifications, panels, loading states, etc.
 */

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

export function showToast(message, type = 'success', duration = 3000) {
    const container = document.getElementById('toast-container');

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ============================================================================
// PANEL MANAGEMENT
// ============================================================================

export function openPanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.style.display = 'flex';
        // Trigger reflow for animation
        panel.offsetHeight;
        panel.classList.add('open');
    }
}

export function closePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel) {
        panel.classList.remove('open');
        setTimeout(() => {
            panel.style.display = 'none';
        }, 300);
    }
}

export function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    if (panel && panel.classList.contains('open')) {
        closePanel(panelId);
    } else {
        openPanel(panelId);
    }
}

// ============================================================================
// LOADING STATE
// ============================================================================

export function showLoading(message = 'Loading...') {
    const loading = document.getElementById('loading');
    const loadingText = loading.querySelector('p');

    if (loadingText) {
        loadingText.textContent = message;
    }

    loading.style.display = 'flex';
    hideWelcome();
    hideGeneratedUI();
    hideError();
}

export function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// ============================================================================
// ERROR DISPLAY
// ============================================================================

export function showError(message) {
    const errorDisplay = document.getElementById('error-display');
    const errorMessage = document.getElementById('error-message');

    errorMessage.textContent = message;
    errorDisplay.style.display = 'flex';

    hideLoading();
    hideWelcome();
    hideGeneratedUI();
}

export function hideError() {
    document.getElementById('error-display').style.display = 'none';
}

// ============================================================================
// CONTENT SCREENS
// ============================================================================

export function showWelcome() {
    document.getElementById('welcome-screen').style.display = 'flex';
    hideGeneratedUI();
    hideLoading();
    hideError();
}

export function hideWelcome() {
    document.getElementById('welcome-screen').style.display = 'none';
}

export function showGeneratedUI() {
    document.getElementById('generated-ui').style.display = 'block';
    hideWelcome();
    hideLoading();
    hideError();
}

export function hideGeneratedUI() {
    document.getElementById('generated-ui').style.display = 'none';
}

// ============================================================================
// GENERATED UI INJECTION
// ============================================================================

export function setGeneratedUI(html) {
    const container = document.getElementById('generated-ui');
    container.innerHTML = html;
    showGeneratedUI();
}

export function clearGeneratedUI() {
    const container = document.getElementById('generated-ui');
    container.innerHTML = '';
}

// ============================================================================
// INPUT HELPERS
// ============================================================================

export function getInputValue(id) {
    const input = document.getElementById(id);
    return input ? input.value.trim() : '';
}

export function setInputValue(id, value) {
    const input = document.getElementById(id);
    if (input) {
        input.value = value;
    }
}

export function clearInput(id) {
    setInputValue(id, '');
}

// ============================================================================
// BUTTON STATE
// ============================================================================

export function disableButton(id) {
    const button = document.getElementById(id);
    if (button) {
        button.disabled = true;
    }
}

export function enableButton(id) {
    const button = document.getElementById(id);
    if (button) {
        button.disabled = false;
    }
}

// ============================================================================
// EVENT HELPERS
// ============================================================================

export function onClick(id, handler) {
    const element = document.getElementById(id);
    if (element) {
        element.addEventListener('click', handler);
    }
}

export function onSubmit(id, handler) {
    const form = document.getElementById(id);
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            handler(e);
        });
    }
}
