const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const SolanaWallet = require('./wallet/solana-wallet');

// Simple file-based storage for wallet
const storageFile = path.join(app.getPath('userData'), 'wallet-storage.json');

function loadStorage() {
  try {
    if (fs.existsSync(storageFile)) {
      return JSON.parse(fs.readFileSync(storageFile, 'utf8'));
    }
  } catch (error) {
    console.error('Failed to load storage:', error);
  }
  return {};
}

function saveStorage(data) {
  try {
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save storage:', error);
  }
}

let storageData = loadStorage();

let mainWindow;
let htmlBrowserView = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Setup resize handler
  setupResizeHandler(mainWindow);

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (htmlBrowserView) {
      htmlBrowserView = null;
    }
  });
}

/**
 * Call Python bridge script with command and arguments
 */
async function callPythonBridge(command, args = []) {
  return new Promise((resolve, reject) => {
    const bridgePath = path.join(__dirname, 'python', 'bridge.py');
    const pythonPath = path.join(__dirname, '..', 'browser-env', 'bin', 'python3');
    const pythonArgs = [bridgePath, command, ...args];

    console.log(`Calling Python bridge: ${pythonPath} ${pythonArgs.join(' ')}`);

    const pythonProcess = spawn(pythonPath, pythonArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          // Parse JSON response from Python
          const result = JSON.parse(stdout.trim());

          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (parseError) {
          console.error('Failed to parse Python response:', stdout);
          reject(new Error(`Failed to parse Python response: ${parseError.message}`));
        }
      } else {
        console.error('Python bridge stderr:', stderr);
        reject(new Error(`Python bridge failed with code ${code}: ${stderr}`));
      }
    });

    pythonProcess.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
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
  return await callPythonBridge('discover', [url]);
});

// Handle complete website generation
ipcMain.handle('generate-website', async (event, descriptor, llmProvider) => {
  const descriptorJson = JSON.stringify(descriptor);
  // Pass LLM provider as additional argument
  return await callPythonBridge('generate-website', [descriptorJson, llmProvider || 'openai']);
});

// Handle API calls
ipcMain.handle('call-api', async (event, url, endpoint, params) => {
  const paramsJson = JSON.stringify(params);
  return await callPythonBridge('call-api', [url, endpoint, paramsJson]);
});

// Natural language queries removed - using direct UI interactions

// BrowserView management for HTML rendering
function getOrCreateBrowserView() {
  if (!htmlBrowserView) {
    htmlBrowserView = new BrowserView({
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });
    mainWindow.addBrowserView(htmlBrowserView);

    // Intercept navigation in BrowserView to check for Socket Agent APIs
    htmlBrowserView.webContents.on('will-navigate', (event, url) => {
      event.preventDefault();
      mainWindow.webContents.send('hybrid-navigate', url);
    });

    // Handle new window requests
    htmlBrowserView.webContents.setWindowOpenHandler(({ url }) => {
      mainWindow.webContents.send('hybrid-navigate', url);
      return { action: 'deny' };
    });
  }
  return htmlBrowserView;
}

// Load URL in BrowserView
ipcMain.handle('load-html-in-browser-view', async (event, url) => {
  try {
    const view = getOrCreateBrowserView();

    // Position BrowserView below the chrome (70px for navigation bar)
    const bounds = mainWindow.getBounds();
    view.setBounds({
      x: 0,
      y: 70,
      width: bounds.width,
      height: bounds.height - 70
    });

    await view.webContents.loadURL(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to load URL in BrowserView:', error);
    return { success: false, error: error.message };
  }
});

// Show BrowserView (HTML mode)
ipcMain.handle('show-browser-view', async () => {
  if (htmlBrowserView) {
    const bounds = mainWindow.getBounds();
    htmlBrowserView.setBounds({
      x: 0,
      y: 70,
      width: bounds.width,
      height: bounds.height - 70
    });
  }
  return { success: true };
});

// Hide BrowserView
ipcMain.handle('hide-browser-view', async () => {
  if (htmlBrowserView) {
    htmlBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
  return { success: true };
});

// Get current mode indicator
ipcMain.handle('get-mode', async () => {
  if (htmlBrowserView) {
    const bounds = htmlBrowserView.getBounds();
    return { mode: bounds.width > 0 ? 'html' : 'socket-agent' };
  }
  return { mode: 'socket-agent' };
});

// Handle window resize to update BrowserView bounds
function setupResizeHandler(window) {
  window.on('resize', () => {
    if (htmlBrowserView) {
      const bounds = window.getBounds();
      // Check if BrowserView is currently visible (width > 0)
      const currentBounds = htmlBrowserView.getBounds();
      if (currentBounds.width > 0) {
        htmlBrowserView.setBounds({
          x: 0,
          y: 70,
          width: bounds.width,
          height: bounds.height - 70
        });
      }
    }
  });
}

// Wallet instance (shared across app) with file-based storage adapter
const storageAdapter = {
  getItem: (key) => storageData[key] || null,
  setItem: (key, value) => {
    storageData[key] = value;
    saveStorage(storageData);
  },
  removeItem: (key) => {
    delete storageData[key];
    saveStorage(storageData);
  }
};

let walletInstance = new SolanaWallet(storageAdapter);

// Wallet IPC handlers
ipcMain.handle('wallet-generate-new', async (event, password) => {
  try {
    const result = await walletInstance.generateNew(password);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-import-mnemonic', async (event, mnemonic, password) => {
  try {
    const result = await walletInstance.importFromMnemonic(mnemonic, password);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-import-private-key', async (event, privateKey, password) => {
  try {
    const result = await walletInstance.importFromPrivateKey(privateKey, password);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-unlock', async (event, password) => {
  try {
    const result = await walletInstance.unlock(password);
    return { success: true, ...result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-lock', async () => {
  walletInstance.lock();
  return { success: true };
});

ipcMain.handle('wallet-get-address', async () => {
  try {
    const address = walletInstance.getAddress();
    return { success: true, address };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-get-balance', async () => {
  try {
    const balance = await walletInstance.getBalance();
    return { success: true, balance };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-export-private-key', async () => {
  try {
    const privateKey = walletInstance.exportPrivateKey();
    return { success: true, privateKey };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('wallet-has-wallet', async () => {
  const hasWallet = walletInstance.hasWallet();
  return { success: true, hasWallet };
});

ipcMain.handle('wallet-is-unlocked', async () => {
  const isUnlocked = walletInstance.isUnlocked;
  return { success: true, isUnlocked };
});