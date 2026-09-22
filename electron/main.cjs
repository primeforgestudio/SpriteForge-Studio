const { app, BrowserWindow, Menu, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

app.name = 'SpriteForge Studio';

// Hardware acceleration and video decoding flags
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

let mainWindow = null;
let pythonProcess = null;

function startPythonBackend() {
  const serverScript = path.join(__dirname, '..', 'backend', 'server.py');
  try {
    pythonProcess = spawn('python', [serverScript, '49221'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    pythonProcess.on('error', (err) => {
      console.log('[SpriteForge] Python backend notice:', err.message);
      pythonProcess = null;
    });
  } catch (e) {
    console.log('[SpriteForge] Python backend start exception:', e);
    pythonProcess = null;
  }
}

function stopPythonBackend() {
  if (pythonProcess) {
    try {
      pythonProcess.kill();
    } catch (e) {}
    pythonProcess = null;
  }
}

function createWindow() {
  const iconPath = process.platform === 'win32'
    ? path.join(__dirname, '..', 'icon.ico')
    : path.join(__dirname, '..', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1200,
    minHeight: 720,
    title: 'SpriteForge Studio',
    icon: iconPath,
    backgroundColor: '#0d0f12',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: false, // Allows local backend media fetching
    },
  });

  Menu.setApplicationMenu(null);

  const isDev = process.env.NODE_ENV === 'development' || process.env.ELECTRON_DEV === '1';

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    mainWindow.loadFile(indexPath);
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers for direct folder export
ipcMain.handle('select-export-directory', async (event, defaultPath) => {
  const initialDir = defaultPath && fs.existsSync(defaultPath)
    ? defaultPath
    : app.getPath('documents');

  const res = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Destination Folder for Export',
    defaultPath: initialDir,
    properties: ['openDirectory', 'createDirectory'],
  });
  return res;
});

ipcMain.handle('save-export-files', async (event, { baseDir, folderName, files }) => {
  try {
    const safeFolderName = (folderName || 'sprites_export')
      .trim()
      .replace(/[<>:"/\\|?*]/g, '_');
    const targetDir = path.join(baseDir, safeFolderName);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    for (const f of files) {
      const filePath = path.join(targetDir, f.name);
      if (f.isText || typeof f.text === 'string') {
        fs.writeFileSync(filePath, f.text, 'utf8');
      } else if (f.data) {
        const buf = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data);
        fs.writeFileSync(filePath, buf);
      }
    }

    // Automatically reveal the newly created folder with exported files in Windows Explorer
    shell.openPath(targetDir);

    return {
      success: true,
      targetDir,
      count: files.length,
    };
  } catch (err) {
    console.error('[SpriteForge] Save export error:', err);
    return {
      success: false,
      error: err.message,
    };
  }
});

ipcMain.handle('open-path', async (event, folderPath) => {
  return await shell.openPath(folderPath);
});

ipcMain.handle('get-default-export-dir', async () => {
  return app.getPath('documents');
});

if (gotTheLock) {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    startPythonBackend();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    stopPythonBackend();
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    stopPythonBackend();
  });
}
