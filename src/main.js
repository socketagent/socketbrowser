const { app, BrowserWindow, BrowserView, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

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

  // Open DevTools in development
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
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

// Show BrowserView
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
});

// Hide BrowserView
ipcMain.handle('hide-browser-view', async () => {
  if (htmlBrowserView) {
    htmlBrowserView.setBounds({ x: 0, y: 0, width: 0, height: 0 });
  }
});

// Handle window resize to update BrowserView bounds
app.on('browser-window-created', () => {
  mainWindow.on('resize', () => {
    if (htmlBrowserView) {
      const bounds = mainWindow.getBounds();
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
});