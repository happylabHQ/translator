const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('overlay', {
  onCaption: callback => ipcRenderer.on('overlay:caption', (_event, value) => callback(value)),
});
