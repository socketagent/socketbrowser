const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle Socket Agent API discovery
ipcMain.handle('discover-socket-agent', async (event, url) => {
  const { discoverSocketAgent } = require('./api/discovery');
  return await discoverSocketAgent(url);
});

// Handle LLM UI generation
ipcMain.handle('generate-ui', async (event, descriptor) => {
  const { generateUI } = require('./llm/ui-generator');
  return await generateUI(descriptor);
});

// Handle API calls
ipcMain.handle('call-api', async (event, url, endpoint, params) => {
  const { callAPI } = require('./api/client');
  return await callAPI(url, endpoint, params);
});