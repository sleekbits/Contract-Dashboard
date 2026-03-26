const { dialog, ipcMain, shell } = require('electron');

function registerIpcHandlers(workbookManager, browserWindow) {
  ipcMain.handle('workbook:get-path', async () => workbookManager.getLiveWorkbookPath());

  ipcMain.handle('workbook:open', async () => {
    const target = workbookManager.getLiveWorkbookPath();
    const error = await shell.openPath(target);
    if (error) throw new Error(error);
    return true;
  });

  ipcMain.handle('workbook:open-folder', async () => {
    shell.showItemInFolder(workbookManager.getLiveWorkbookPath());
    return true;
  });

  ipcMain.handle('workbook:refresh', async () => workbookManager.readWorkbook());

  ipcMain.handle('workbook:save-mappings', async (_event, mappings) => {
    workbookManager.saveUserMappings(mappings);
    return true;
  });

  ipcMain.handle('workbook:reset', async () => {
    const result = await dialog.showMessageBox(browserWindow, {
      type: 'warning',
      buttons: ['Reset', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Reset workbook from template',
      message: 'This will overwrite your live workbook and create a backup copy first.'
    });

    if (result.response !== 0) {
      return { cancelled: true };
    }

    const resetInfo = workbookManager.resetFromTemplate();
    const data = workbookManager.readWorkbook();
    return { cancelled: false, ...resetInfo, data };
  });

  ipcMain.on('workbook:listen-updates', (event) => {
    const sender = event.sender;
    const onUpdate = (data) => {
      if (!sender.isDestroyed()) {
        sender.send('workbook:updated', data);
      }
    };

    workbookManager.startWatching(onUpdate);
  });
}

module.exports = { registerIpcHandlers };
