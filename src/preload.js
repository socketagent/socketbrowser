const { contextBridge, ipcRenderer } = require('electron');

// Expose APIs to the rendered pages (both browser UI and generated websites)
contextBridge.exposeInMainWorld('electronAPI', {
  // For the browser interface
  discoverSocketAgent: (url) => ipcRenderer.invoke('discover-socket-agent', url),
  generateWebsite: (descriptor) => ipcRenderer.invoke('generate-website', descriptor),

  // For generated websites to call APIs
  callAPI: (url, endpoint, params) => ipcRenderer.invoke('call-api', url, endpoint, params)
});