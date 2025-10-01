const { contextBridge, ipcRenderer } = require('electron');

// Expose APIs to the rendered pages (both browser UI and generated websites)
contextBridge.exposeInMainWorld('electronAPI', {
  // For the browser interface
  discoverSocketAgent: (url) => ipcRenderer.invoke('discover-socket-agent', url),
  generateWebsite: (descriptor, llmProvider) => ipcRenderer.invoke('generate-website', descriptor, llmProvider),

  // For generated websites to call APIs
  callAPI: (url, endpoint, params) => ipcRenderer.invoke('call-api', url, endpoint, params),

  // BrowserView management for hybrid rendering
  loadHTMLInBrowserView: (url) => ipcRenderer.invoke('load-html-in-browser-view', url),
  showBrowserView: () => ipcRenderer.invoke('show-browser-view'),
  hideBrowserView: () => ipcRenderer.invoke('hide-browser-view'),

  // Listen for navigation events from BrowserView
  onHybridNavigate: (callback) => ipcRenderer.on('hybrid-navigate', (event, url) => callback(url))
});