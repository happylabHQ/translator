const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  diagnostic: stage => ipcRenderer.send('desktop:diagnostic', stage),
  settings: () => ipcRenderer.invoke('desktop:settings'),
  configure: value => ipcRenderer.invoke('desktop:configure', value),
  caption: text => ipcRenderer.send('desktop:caption', text),
  delta: text => ipcRenderer.send('desktop:delta', text),
  status: state => ipcRenderer.send('desktop:status', state),
  preview: () => ipcRenderer.send('desktop:preview'),
  onSettings: callback => ipcRenderer.on('desktop:settings', (_event, value) => callback(value)),
  onReconnect: callback => ipcRenderer.on('desktop:reconnect', () => callback()),
});
