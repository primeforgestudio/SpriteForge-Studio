const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExportDirectory: (defaultPath) => ipcRenderer.invoke('select-export-directory', defaultPath),
  saveExportFiles: (options) => ipcRenderer.invoke('save-export-files', options),
  openPath: (folderPath) => ipcRenderer.invoke('open-path', folderPath),
  getDefaultExportDir: () => ipcRenderer.invoke('get-default-export-dir'),
});
