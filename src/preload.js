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
  getMode: () => ipcRenderer.invoke('get-mode'),

  // Wallet operations
  wallet: {
    generateNew: (password) => ipcRenderer.invoke('wallet-generate-new', password),
    importFromMnemonic: (mnemonic, password) => ipcRenderer.invoke('wallet-import-mnemonic', mnemonic, password),
    importFromPrivateKey: (privateKey, password) => ipcRenderer.invoke('wallet-import-private-key', privateKey, password),
    unlock: (password) => ipcRenderer.invoke('wallet-unlock', password),
    lock: () => ipcRenderer.invoke('wallet-lock'),
    getAddress: () => ipcRenderer.invoke('wallet-get-address'),
    getBalance: () => ipcRenderer.invoke('wallet-get-balance'),
    exportPrivateKey: () => ipcRenderer.invoke('wallet-export-private-key'),
    hasWallet: () => ipcRenderer.invoke('wallet-has-wallet'),
    isUnlocked: () => ipcRenderer.invoke('wallet-is-unlocked')
  },

  // Listen for navigation events from BrowserView
  onHybridNavigate: (callback) => ipcRenderer.on('hybrid-navigate', (event, url) => callback(url)),

  // Storage for auth and other data
  getStorage: (key) => ipcRenderer.invoke('get-storage', key),
  setStorage: (key, value) => ipcRenderer.invoke('set-storage', key, value),

  // Open external links
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});