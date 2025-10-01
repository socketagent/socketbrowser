/**
 * Hybrid Renderer - Manages both Socket Agent and Traditional HTML rendering
 */

class HybridRenderer {
    constructor() {
        this.mode = null; // 'socket-agent' or 'html'
        this.currentUrl = null;
        this.socketAgentDiv = document.getElementById('generated-ui');
        this.htmlView = document.getElementById('html-view');
    }

    /**
     * Detect if a URL is a Socket Agent API or traditional HTML
     */
    async detectMode(url) {
        try {
            // Try Socket Agent discovery first
            const discoveryResult = await window.electronAPI.discoverSocketAgent(url);

            if (discoveryResult.success) {
                return {
                    mode: 'socket-agent',
                    descriptor: discoveryResult.descriptor
                };
            }
        } catch (error) {
            // Discovery failed, assume traditional HTML
            console.log('Socket Agent discovery failed, falling back to HTML mode');
        }

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
            await this.renderSocketAgent(url, detection.descriptor);
        } else {
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
        window.bindGeneratedUIEvents();
    }

    /**
     * Render traditional HTML website using BrowserView
     */
    async renderHTML(url) {
        this.switchToHTML();

        // Request main process to load URL in BrowserView
        await window.electronAPI.loadHTMLInBrowserView(url);
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
