// Use the exposed electronAPI instead of direct ipcRenderer

// DOM elements
const urlInput = document.getElementById('url-input');
const navigateBtn = document.getElementById('navigate-btn');
const naturalLanguageBar = document.getElementById('natural-language-bar');
const questionInput = document.getElementById('question-input');
const askBtn = document.getElementById('ask-btn');
const welcomeScreen = document.getElementById('welcome');
const loadingScreen = document.getElementById('loading');
const generatedUI = document.getElementById('generated-ui');
const errorScreen = document.getElementById('error');
const errorMessage = document.getElementById('error-message');
const retryBtn = document.getElementById('retry-btn');
const debugPanel = document.getElementById('debug-panel');
const debugContent = document.getElementById('debug-content');

let currentUrl = '';
let currentDescriptor = null;

// Event listeners
navigateBtn.addEventListener('click', handleNavigation);
urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNavigation();
});
retryBtn.addEventListener('click', handleNavigation);

// Natural language event listeners
askBtn.addEventListener('click', handleNaturalLanguageQuery);
questionInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleNaturalLanguageQuery();
});

// Quick links
document.querySelectorAll('.quick-link').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const url = e.target.getAttribute('data-url');
        urlInput.value = url;
        handleNavigation();
    });
});

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
        const websiteResult = await window.electronAPI.generateWebsite(currentDescriptor);

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

    // Hide the natural language bar for now - complete websites shouldn't need it
    naturalLanguageBar.classList.add('hidden');

    log('Complete website loaded and ready for interaction');
}

function showError(message) {
    hideAllScreens();
    errorMessage.textContent = message;
    errorScreen.classList.remove('hidden');
}

function showWelcome() {
    hideAllScreens();
    naturalLanguageBar.classList.add('hidden');
    welcomeScreen.classList.remove('hidden');
}

function hideAllScreens() {
    [welcomeScreen, loadingScreen, generatedUI, errorScreen].forEach(el => {
        el.classList.add('hidden');
    });
}

function bindGeneratedUIEvents() {
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

    // Find all forms and prevent default submission
    const forms = generatedUI.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    });
}

async function handleAPICall(endpoint, params, buttonElement) {
    const originalText = buttonElement.textContent;
    buttonElement.textContent = 'Loading...';
    buttonElement.disabled = true;

    try {
        log(`Calling API: ${endpoint} with params:`, params);
        const apiResult = await ipcRenderer.invoke('call-api', currentUrl, endpoint, params);
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

async function handleNaturalLanguageQuery() {
    const question = questionInput.value.trim();
    if (!question || !currentUrl) return;

    const originalText = askBtn.textContent;
    askBtn.textContent = 'Asking...';
    askBtn.disabled = true;

    try {
        log(`Natural language query: "${question}"`);
        const queryResult = await ipcRenderer.invoke('ask-question', currentUrl, question);

        if (queryResult.success) {
            // Display the natural language result
            displayNaturalLanguageResult(queryResult.result);
        } else {
            displayNaturalLanguageError(queryResult.error);
        }

    } catch (error) {
        log('Natural language query error:', error.message);
        displayNaturalLanguageError(error.message);
    } finally {
        askBtn.textContent = originalText;
        askBtn.disabled = false;
        questionInput.value = ''; // Clear the input
    }
}

function displayNaturalLanguageResult(result) {
    // Create or update natural language result container
    let resultContainer = document.getElementById('natural-language-result');
    if (!resultContainer) {
        resultContainer = document.createElement('div');
        resultContainer.id = 'natural-language-result';
        resultContainer.className = 'natural-language-result';
        generatedUI.insertBefore(resultContainer, generatedUI.firstChild);
    }

    resultContainer.innerHTML = `
        <div class="natural-result">
            <h3>🤖 AI Response</h3>
            <div class="result-content">${result}</div>
            <button onclick="this.parentNode.parentNode.style.display='none'" class="close-btn">×</button>
        </div>
    `;
}

function displayNaturalLanguageError(error) {
    // Create or update natural language error container
    let errorContainer = document.getElementById('natural-language-result');
    if (!errorContainer) {
        errorContainer = document.createElement('div');
        errorContainer.id = 'natural-language-result';
        errorContainer.className = 'natural-language-result';
        generatedUI.insertBefore(errorContainer, generatedUI.firstChild);
    }

    errorContainer.innerHTML = `
        <div class="natural-error">
            <h3>❌ Error</h3>
            <div class="error-content">${error}</div>
            <button onclick="this.parentNode.parentNode.style.display='none'" class="close-btn">×</button>
        </div>
    `;
}

// Initialize
log('Socket Browser initialized');
showWelcome();