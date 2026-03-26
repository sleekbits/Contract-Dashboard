const path = require('node:path');
const { app, BrowserWindow } = require('electron');
const { WorkbookManager } = require('./workbookManager');
const { registerIpcHandlers } = require('./ipcHandlers');

let mainWindow;
const workbookManager = new WorkbookManager();

async function createWindow() {
  await workbookManager.ensureLiveWorkbook();

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  registerIpcHandlers(workbookManager, mainWindow);

  const initialData = workbookManager.readWorkbook();
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('workbook:updated', initialData);
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  workbookManager.stopWatching();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
