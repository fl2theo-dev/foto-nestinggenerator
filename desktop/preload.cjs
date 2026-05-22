const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopApi', {
  exportProductionJpeg: (job) => ipcRenderer.invoke('desktop:exportProductionJpeg', job)
});
