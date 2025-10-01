// Use the exposed electronAPI instead of direct ipcRenderer

// DOM elements
const urlInput = document.getElementById('url-input');
const navigateBtn = document.getElementById('navigate-btn');
const backBtn = document.getElementById('back-btn');
const forwardBtn = document.getElementById('forward-btn');
const homeBtn = document.getElementById('home-btn');
const llmToggleBtn = document.getElementById('llm-toggle-btn');
const llmIcon = document.getElementById('llm-icon');
const llmName = document.getElementById('llm-name');
// Natural language interface removed
const blankScreen = document.getElementById('blank');
const loadingScreen = document.getElementById('loading');
const generatedUI = document.getElementById('generated-ui');
const errorScreen = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const debugPanel = document.getElementById('debug-panel');
const debugContent = document.getElementById('debug-content');

let currentUrl = '';
let currentDescriptor = null;
let navigationHistory = []; // Stack for back/forward navigation
let currentHistoryIndex = -1;
let currentLLMProvider = 'openai'; // Track current provider

// Event listeners
navigateBtn.addEventListener('click', handleNavigation);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNavigation();
});
retryBtn.addEventListener('click', handleNavigation);
backBtn.addEventListener('click', goBack);
forwardBtn.addEventListener('click', goForward);
homeBtn.addEventListener('click', goHome);
llmToggleBtn.addEventListener('click', toggleLLMProvider);

// Initialize LLM provider display
updateLLMDisplay();

// Natural language interface removed

// No quick links - removed hardcoded elements

// Debug toggle (Ctrl+D)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'd') {
        e.preventDefault();
        debugPanel.classList.toggle('hidden');
    }
});

async function handleNavigation() {
    const url = urlInput.value.trim();
    if (!url) return;

    currentUrl = url;
    showLoading();

    try {
        // Step 1: Discover Socket Agent API
        log('Discovering Socket Agent API...');
        const discoveryResult = await window.electronAPI.discoverSocketAgent(url);

        if (!discoveryResult.success) {
            throw new Error(discoveryResult.error);
        }

        currentDescriptor = discoveryResult.descriptor;
        log('API discovered:', currentDescriptor);

        // Step 2: Generate complete website using LLM
        log('Generating complete website with LLM...');
        const websiteResult = await window.electronAPI.generateWebsite(currentDescriptor, currentLLMProvider);

        if (!websiteResult.success) {
            throw new Error(websiteResult.error || 'Website generation failed');
        }

        const generatedWebsite = websiteResult.html;
        log('Website generated');

        // Step 3: Display generated website
        showGeneratedWebsite(generatedWebsite);

    } catch (error) {
        log('Error:', error.message);
        showError(error.message);
    }
}

function showLoading() {
    hideAllScreens();
    loadingScreen.classList.remove('hidden');
}

function showGeneratedWebsite(html) {
    hideAllScreens();
    generatedUI.innerHTML = html;
    generatedUI.classList.remove('hidden');

    // Generate UI displayed - bind events for API calls
    bindGeneratedUIEvents();

    log('Complete website loaded and ready for interaction');
}

function showError(message) {
    hideAllScreens();
    errorMessage.textContent = message;
    errorScreen.classList.remove('hidden');
}

function showBlank() {
    hideAllScreens();
    blankScreen.classList.remove('hidden');
}

function hideAllScreens() {
    [blankScreen, loadingScreen, generatedUI, errorScreen].forEach(el => {
        el.classList.add('hidden');
    });
}

function bindGeneratedUIEvents() {
    // Intercept ALL links for navigation
    const links = generatedUI.querySelectorAll('a[href]');
    links.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            await handleLinkNavigation(href);
        });
    });

    // Find all API buttons and bind them
    const apiButtons = generatedUI.querySelectorAll('[data-api-call]');
    apiButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            const endpoint = e.target.getAttribute('data-api-call');
            const form = e.target.closest('form') || e.target.closest('.api-form');

            let params = {};
            if (form) {
                const formData = new FormData(form);
                for (const [key, value] of formData.entries()) {
                    params[key] = value;
                }
            }

            await handleAPICall(endpoint, params, e.target);
        });
    });

    // Find all forms and handle submission
    const forms = generatedUI.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleFormSubmission(form);
        });
    });
}

async function handleAPICall(endpoint, params, buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Loading...';
    buttonElement.disabled = true;

    try {
        log(`Calling API: ${endpoint} with params:`, params);
        const apiResult = await window.electronAPI.callAPI(currentUrl, endpoint, params);
        log('API result:', apiResult);

        if (apiResult.success) {
            // Display successful result
            displayAPIResult(apiResult.data, buttonElement);
        } else {
            // Display error from API
            displayAPIError(apiResult.error, buttonElement);
        }

    } catch (error) {
        log('API call error:', error.message);
        displayAPIError(error.message, buttonElement);
    } finally {
        buttonElement.textContent = originalText;
        buttonElement.disabled = false;
    }
}

function displayAPIResult(result, buttonElement) {
    // Find or create result container
    let resultContainer = buttonElement.parentNode.querySelector('.api-results');
    if (!resultContainer) {
        resultContainer = document.createElement('div');
        resultContainer.className = 'api-results';
        buttonElement.parentNode.appendChild(resultContainer);
    }

    // Clear any error containers
    const errorContainer = buttonElement.parentNode.querySelector('.api-error');
    if (errorContainer) {
        errorContainer.remove();
    }

    // Format and display result
    if (typeof result === 'object') {
        resultContainer.innerHTML = `
            <h4>✅ Success!</h4>
            <pre>${JSON.stringify(result, null, 2)}</pre>
        `;
    } else {
        resultContainer.innerHTML = `
            <h4>✅ Success!</h4>
            <p>${result}</p>
        `;
    }
}

function displayAPIError(error, buttonElement) {
    // Find or create error container
    let errorContainer = buttonElement.parentNode.querySelector('.api-error');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.className = 'api-error';
        buttonElement.parentNode.appendChild(errorContainer);
    }

    // Clear any result containers
    const resultContainer = buttonElement.parentNode.querySelector('.api-results');
    if (resultContainer) {
        resultContainer.remove();
    }

    errorContainer.innerHTML = `
        <h4>❌ Error</h4>
        <p>${error}</p>
    `;
}

async function handleLinkNavigation(href) {
    log(`Link clicked: ${href}`);

    // Classify the link
    if (href.startsWith('http://') || href.startsWith('https://')) {
        // External Socket Agent service - discover new service
        await navigateToNewService(href);
    } else if (href.startsWith('#')) {
        // Hash navigation - ignore, let generated JS handle it
        log('Hash navigation - handled by page JavaScript');
    } else {
        // Relative path - make API call and regenerate page
        await navigateToPath(href);
    }
}

async function navigateToNewService(url) {
    log(`Discovering new Socket Agent service: ${url}`);

    // Save current state to history
    addToHistory(currentUrl, currentDescriptor, generatedUI.innerHTML);

    // Navigate to new service (same as initial navigation)
    currentUrl = url;
    urlInput.value = url;
    await handleNavigation();
}

async function navigateToPath(path) {
    log(`Navigating to path: ${path}`);
    showLoading();

    try {
        // Make API call to this path
        const apiResult = await window.electronAPI.callAPI(currentUrl, path, {});

        if (apiResult.success) {
            // Save current state to history
            addToHistory(currentUrl, currentDescriptor, generatedUI.innerHTML);

            // Regenerate page based on the response
            await regeneratePageWithData(apiResult.data, path);
        } else {
            showError(`Failed to navigate to ${path}: ${apiResult.error}`);
        }
    } catch (error) {
        log('Navigation error:', error.message);
        showError(error.message);
    }
}

async function regeneratePageWithData(data, context) {
    log('Regenerating page with new data...', data);

    try {
        // Create enhanced descriptor with context
        const enhancedDescriptor = {
            ...currentDescriptor,
            context: {
                currentPath: context,
                data: data
            }
        };

        // Generate new page with current LLM provider
        const websiteResult = await window.electronAPI.generateWebsite(enhancedDescriptor, currentLLMProvider);

        if (!websiteResult.success) {
            throw new Error(websiteResult.error || 'Page generation failed');
        }

        showGeneratedWebsite(websiteResult.html);
    } catch (error) {
        log('Error regenerating page:', error.message);
        showError(error.message);
    }
}

async function handleFormSubmission(form) {
    log('Form submitted');

    // Get form action (endpoint) and method
    const action = form.getAttribute('action') || form.querySelector('[data-api-call]')?.getAttribute('data-api-call');
    const method = form.getAttribute('method') || 'POST';

    if (!action) {
        log('No action found for form');
        return;
    }

    // Collect form data
    const formData = new FormData(form);
    const params = {};
    for (const [key, value] of formData.entries()) {
        params[key] = value;
    }

    showLoading();

    try {
        // Make API call
        const apiResult = await window.electronAPI.callAPI(currentUrl, action, params);

        if (apiResult.success) {
            // Save current state to history
            addToHistory(currentUrl, currentDescriptor, generatedUI.innerHTML);

            // Regenerate page with result
            await regeneratePageWithData(apiResult.data, action);
        } else {
            showError(`Form submission failed: ${apiResult.error}`);
        }
    } catch (error) {
        log('Form submission error:', error.message);
        showError(error.message);
    }
}

function addToHistory(url, descriptor, html) {
    // Trim forward history if we're not at the end
    if (currentHistoryIndex < navigationHistory.length - 1) {
        navigationHistory = navigationHistory.slice(0, currentHistoryIndex + 1);
    }

    // Add current state to history
    navigationHistory.push({
        url: url,
        descriptor: descriptor,
        html: html,
        timestamp: Date.now()
    });
    currentHistoryIndex = navigationHistory.length - 1;
    log(`Added to history. Stack size: ${navigationHistory.length}`);
    updateNavigationButtons();
}

function goBack() {
    if (currentHistoryIndex > 0) {
        currentHistoryIndex--;
        const historyEntry = navigationHistory[currentHistoryIndex];

        log(`Going back to: ${historyEntry.url}`);

        // Restore state
        currentUrl = historyEntry.url;
        currentDescriptor = historyEntry.descriptor;
        urlInput.value = historyEntry.url;

        // Restore page without adding to history
        generatedUI.innerHTML = historyEntry.html;
        bindGeneratedUIEvents();
        showGeneratedWebsite(historyEntry.html);

        updateNavigationButtons();
    }
}

function goForward() {
    if (currentHistoryIndex < navigationHistory.length - 1) {
        currentHistoryIndex++;
        const historyEntry = navigationHistory[currentHistoryIndex];

        log(`Going forward to: ${historyEntry.url}`);

        // Restore state
        currentUrl = historyEntry.url;
        currentDescriptor = historyEntry.descriptor;
        urlInput.value = historyEntry.url;

        // Restore page without adding to history
        generatedUI.innerHTML = historyEntry.html;
        bindGeneratedUIEvents();
        showGeneratedWebsite(historyEntry.html);

        updateNavigationButtons();
    }
}

function goHome() {
    if (navigationHistory.length > 0) {
        // Go to first item in history
        currentHistoryIndex = 0;
        const historyEntry = navigationHistory[0];

        log(`Going home to: ${historyEntry.url}`);

        // Restore state
        currentUrl = historyEntry.url;
        currentDescriptor = historyEntry.descriptor;
        urlInput.value = historyEntry.url;

        // Restore page
        generatedUI.innerHTML = historyEntry.html;
        bindGeneratedUIEvents();
        showGeneratedWebsite(historyEntry.html);

        updateNavigationButtons();
    }
}

function updateNavigationButtons() {
    backBtn.disabled = currentHistoryIndex <= 0;
    forwardBtn.disabled = currentHistoryIndex >= navigationHistory.length - 1;
}

function toggleLLMProvider() {
    // Toggle between providers
    currentLLMProvider = currentLLMProvider === 'openai' ? 'ollama' : 'openai';

    log(`Switched to ${currentLLMProvider.toUpperCase()}`);
    updateLLMDisplay();

    // Show notification
    showNotification(`Now using ${currentLLMProvider === 'openai' ? 'OpenAI (GPT-4o)' : 'Ollama (Local)'}`);
}

function updateLLMDisplay() {
    if (currentLLMProvider === 'openai') {
        llmIcon.textContent = '🤖';
        llmName.textContent = 'OpenAI';
        llmToggleBtn.classList.remove('ollama');
        llmToggleBtn.title = 'Using OpenAI GPT-4o - Click to switch to Ollama';
    } else {
        llmIcon.textContent = '🏠';
        llmName.textContent = 'Ollama';
        llmToggleBtn.classList.add('ollama');
        llmToggleBtn.title = 'Using Ollama (Local) - Click to switch to OpenAI';
    }
}

function showNotification(message) {
    // Simple notification in debug panel
    log(`[NOTIFICATION] ${message}`);

    // TODO: Add toast notification UI later
}

function log(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.style.marginBottom = '5px';
    logEntry.style.borderBottom = '1px solid #333';
    logEntry.style.paddingBottom = '5px';

    if (data) {
        logEntry.innerHTML = `
            <strong>${timestamp}:</strong> ${message}<br>
            <code>${JSON.stringify(data, null, 2)}</code>
        `;
    } else {
        logEntry.innerHTML = `<strong>${timestamp}:</strong> ${message}`;
    }

    debugContent.appendChild(logEntry);
    debugContent.scrollTop = debugContent.scrollHeight;

    console.log(message, data);
}

// Natural language functions removed - using direct UI interactions only

// Initialize
log('Socket Browser initialized');
showBlank();