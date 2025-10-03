/**
 * Hybrid Renderer - Manages both Socket Agent and Traditional HTML rendering
 *
 * Design Philosophy:
 * - Default to HTML mode (like a normal browser)
 * - Try Socket Agent discovery, fallback gracefully
 * - Visual mode indicator (color-coded chrome)
 */

class HybridRenderer {
    constructor() {
        this.mode = 'html'; // Default to HTML mode
        this.currentUrl = null;
        this.socketAgentDiv = document.getElementById('generated-ui');
        this.htmlView = document.getElementById('html-view');
        this.chrome = document.getElementById('browser-chrome');
        this.modeBadge = document.getElementById('mode-badge');

        // Initialize in HTML mode
        this.updateModeIndicator('html');
    }

    /**
     * Detect if a URL is a Socket Agent API or traditional HTML
     * Returns: { mode: 'socket-agent' | 'html', descriptor?: object }
     */
    async detectMode(url) {
        try {
            // Try Socket Agent discovery first
            const discoveryResult = await window.electronAPI.discoverSocketAgent(url);

            if (discoveryResult.success && discoveryResult.descriptor) {
                console.log('✓ Socket Agent API detected:', discoveryResult.descriptor.name);
                return {
                    mode: 'socket-agent',
                    descriptor: discoveryResult.descriptor
                };
            }
        } catch (error) {
            console.log('Socket Agent discovery failed, assuming HTML mode:', error.message);
        }

        // Default to HTML mode
        return {
            mode: 'html',
            descriptor: null
        };
    }

    /**
     * Render a URL using the appropriate mode
     */
    async render(url) {
        this.currentUrl = url;

        // Detect which mode to use
        const detection = await this.detectMode(url);

        if (detection.mode === 'socket-agent') {
            console.log('→ Rendering in Socket Agent mode');
            await this.renderSocketAgent(url, detection.descriptor);
        } else {
            console.log('→ Rendering in HTML mode');
            await this.renderHTML(url);
        }
    }

    /**
     * Render Socket Agent API with LLM-generated UI
     */
    async renderSocketAgent(url, descriptor) {
        this.switchToSocketAgent();

        // Use existing Socket Agent rendering logic
        const currentLLMProvider = window.currentLLMProvider || 'openai';
        const websiteResult = await window.electronAPI.generateWebsite(descriptor, currentLLMProvider);

        if (!websiteResult.success) {
            throw new Error(websiteResult.error || 'Website generation failed');
        }

        this.socketAgentDiv.innerHTML = websiteResult.html;

        // Bind events for API calls
        if (window.bindGeneratedUIEvents) {
            window.bindGeneratedUIEvents();
        }
    }

    /**
     * Render traditional HTML website using BrowserView
     */
    async renderHTML(url) {
        this.switchToHTML();

        // Request main process to load URL in BrowserView
        const result = await window.electronAPI.loadHTMLInBrowserView(url);

        if (!result.success) {
            throw new Error(result.error || 'Failed to load HTML content');
        }
    }

    /**
     * Switch to Socket Agent rendering mode
     */
    switchToSocketAgent() {
        this.socketAgentDiv.classList.remove('hidden');
        this.htmlView.classList.add('hidden');
        this.mode = 'socket-agent';

        // Hide BrowserView in main process
        window.electronAPI.hideBrowserView();

        // Update visual indicator
        this.updateModeIndicator('socket-agent');
    }

    /**
     * Switch to HTML rendering mode
     */
    switchToHTML() {
        this.socketAgentDiv.classList.add('hidden');
        this.htmlView.classList.remove('hidden');
        this.mode = 'html';

        // Show BrowserView in main process
        window.electronAPI.showBrowserView();

        // Update visual indicator
        this.updateModeIndicator('html');
    }

    /**
     * Update visual mode indicator with color coding
     */
    updateModeIndicator(mode) {
        if (mode === 'socket-agent') {
            // Purple/pink for AI-generated mode
            this.chrome.classList.add('socket-agent-mode');
            this.chrome.classList.remove('html-mode');
            this.modeBadge.textContent = '⚡ Socket Agent';
            this.modeBadge.title = 'AI-generated interface from Socket Agent API';
        } else {
            // Blue/neutral for HTML mode
            this.chrome.classList.remove('socket-agent-mode');
            this.chrome.classList.add('html-mode');
            this.modeBadge.textContent = '🌐 HTML';
            this.modeBadge.title = 'Traditional HTML website';
        }
    }

    /**
     * Get current rendering mode
     */
    getMode() {
        return this.mode;
    }

    /**
     * Check if currently in Socket Agent mode
     */
    isSocketAgentMode() {
        return this.mode === 'socket-agent';
    }

    /**
     * Check if currently in HTML mode
     */
    isHTMLMode() {
        return this.mode === 'html';
    }
}

// Export for use in renderer.js
window.HybridRenderer = HybridRenderer;
