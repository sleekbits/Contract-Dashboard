const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('contractItApi', {
  getLiveWorkbookPath: () => ipcRenderer.invoke('workbook:get-path'),
  openWorkbook: () => ipcRenderer.invoke('workbook:open'),
  openWorkbookFolder: () => ipcRenderer.invoke('workbook:open-folder'),
  resetWorkbookFromTemplate: () => ipcRenderer.invoke('workbook:reset'),
  requestRefresh: () => ipcRenderer.invoke('workbook:refresh'),
  saveColumnMappings: (mappings) => ipcRenderer.invoke('workbook:save-mappings', mappings),
  startWorkbookWatcher: () => ipcRenderer.send('workbook:listen-updates'),
  onWorkbookUpdated: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('workbook:updated', handler);
    return () => ipcRenderer.removeListener('workbook:updated', handler);
  }
});
