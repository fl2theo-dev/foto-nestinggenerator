const path = require('path');
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { renderProductionJob } = require('./production-exporter.cjs');

function createMainWindow() {
  const win = new BrowserWindow({
    width: 1520,
    height: 980,
    minWidth: 1200,
    minHeight: 760,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile(path.join(__dirname, '..', 'app', 'index.html'));
}

ipcMain.handle('desktop:exportProductionJpeg', async (_event, job) => {
  try {
    if (!job || !Array.isArray(job.pages) || job.pages.length === 0) {
      return { ok: false, message: 'Kein gueltiger Exportjob uebergeben.' };
    }

    const picked = await dialog.showOpenDialog({
      title: 'Zielordner fuer druckfertige JPEGs waehlen',
      properties: ['openDirectory', 'createDirectory']
    });

    if (picked.canceled || !picked.filePaths || picked.filePaths.length === 0) {
      return { ok: false, message: 'Desktop-Export abgebrochen.' };
    }

    const outputDir = picked.filePaths[0];
    const appRoot = path.join(__dirname, '..');
    const result = await renderProductionJob(job, outputDir, appRoot);
    return {
      ok: true,
      count: result.files.length,
      profileMode: result.profileMode
    };
  } catch (error) {
    return {
      ok: false,
      message: `Desktop-Export fehlgeschlagen: ${error.message}`
    };
  }
});

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
