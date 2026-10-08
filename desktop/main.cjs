const { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog, powerSaveBlocker } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { allowsAudioCheck } = require('./permissions.cjs');

// Plain text does not need GPU acceleration. Disable it before Chromium starts,
// avoiding graphics-driver dependencies on the presentation computer.
app.disableHardwareAcceleration();
const logPath = path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath(), 'startup.log');
function diagnostic(event, details = {}) {
  try {
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > 128 * 1024) fs.writeFileSync(logPath, '');
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${event} ${JSON.stringify(details)}\n`);
  } catch { /* A read-only install directory must not prevent startup. */ }
}
diagnostic('starting', { version: app.getVersion(), platform: process.platform, arch: process.arch,
  electron: process.versions.electron, hardwareAcceleration: false });
// Use an isolated Windows profile rather than the cache used by the first build.
// No cache deletion or changes to other applications are necessary.
if (process.platform === 'win32') {
  try {
    const profile = path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'LiveTranslationOverlay');
    fs.mkdirSync(profile, { recursive: true });
    app.setPath('userData', profile);
    app.setPath('sessionData', profile);
    diagnostic('windows-profile-ready');
  } catch (error) { diagnostic('windows-profile-unavailable', { code: error.code }); }
}
app.on('child-process-gone', (_event, details) => diagnostic('child-process-gone', {
  type: details.type, reason: details.reason, exitCode: details.exitCode,
}));

let controller, overlay, server, origin;
let selectedDisplay;
let fontSize = 48;
let bottom = 24;
let visible = true;
let previewTimer;
let blocker;
let controlsFailed = false;
let shuttingDown = false;
const rendererStages = new Set(['controls-script-started', 'controls-script-ready',
  'devices-query-started', 'devices-query-complete', 'microphone-request-started', 'microphone-request-granted']);

function windowAlive(window) {
  return Boolean(window && !window.isDestroyed() && !window.webContents.isDestroyed());
}

function sendTo(window, channel, value) {
  if (shuttingDown || !windowAlive(window)) return;
  window.webContents.send(channel, value);
}

function displays() {
  return screen.getAllDisplays().map(display => ({
    id: display.id,
    label: `${display.label || 'Display'} · ${display.size.width} × ${display.size.height}${display.id === screen.getPrimaryDisplay().id ? ' (primary)' : ''}`,
  }));
}

function settings() {
  return { displays: displays(), displayId: selectedDisplay, fontSize, bottom, visible };
}

function positionOverlay() {
  if (shuttingDown || !windowAlive(overlay)) return;
  const available = screen.getAllDisplays();
  const display = available.find(d => d.id === selectedDisplay) || screen.getPrimaryDisplay();
  selectedDisplay = display.id;
  const margin = Math.round(display.bounds.width * 0.04);
  const height = Math.ceil(fontSize * 1.3 * 2 + 24);
  const offset = Math.min(bottom, Math.max(0, display.bounds.height - height));
  overlay.setBounds({ x: display.bounds.x + margin,
    y: display.bounds.y + display.bounds.height - height - offset,
    width: display.bounds.width - margin * 2, height });
  sendTo(overlay, 'overlay:caption', { fontSize });
  if (visible) {
    overlay.showInactive();
    overlay.setAlwaysOnTop(true, 'screen-saver');
  } else overlay.hide();
  sendTo(controller, 'desktop:settings', settings());
}

function updateCaption(text) {
  sendTo(overlay, 'overlay:caption', { text: text.slice(-2000), fontSize });
}

function trusted(event) {
  return !shuttingDown && windowAlive(controller) && event.sender === controller.webContents &&
    event.senderFrame === controller.webContents.mainFrame;
}

function installIPC() {
  ipcMain.on('desktop:diagnostic', (event, stage) => {
    if (trusted(event) && rendererStages.has(stage)) diagnostic(stage);
  });
  ipcMain.handle('desktop:settings', event => trusted(event) ? settings() : null);
  ipcMain.handle('desktop:configure', (event, value) => {
    if (!trusted(event) || !value || typeof value !== 'object') return null;
    if (screen.getAllDisplays().some(d => d.id === value.displayId)) selectedDisplay = value.displayId;
    if (Number.isFinite(value.fontSize)) fontSize = Math.max(24, Math.min(96, Math.round(value.fontSize)));
    if (Number.isFinite(value.bottom)) bottom = Math.max(0, Math.min(400, Math.round(value.bottom)));
    if (typeof value.visible === 'boolean') visible = value.visible;
    positionOverlay();
    return settings();
  });
  ipcMain.on('desktop:caption', (event, text) => {
    if (!trusted(event) || typeof text !== 'string') return;
    clearTimeout(previewTimer);
    updateCaption(text);
  });
  ipcMain.on('desktop:delta', (event, text) => {
    if (!trusted(event) || typeof text !== 'string') return;
    clearTimeout(previewTimer);
    sendTo(overlay, 'overlay:caption', { delta: text.slice(-2000), fontSize });
  });
  ipcMain.on('desktop:status', (event, state) => {
    if (!trusted(event)) return;
    if (state === 'Connected' && blocker === undefined) blocker = powerSaveBlocker.start('prevent-display-sleep');
    if (state !== 'Connected') {
      if (blocker !== undefined) { powerSaveBlocker.stop(blocker); blocker = undefined; }
      clearTimeout(previewTimer);
      updateCaption('');
    }
  });
  ipcMain.on('desktop:preview', event => {
    if (!trusted(event) || blocker !== undefined) return;
    clearTimeout(previewTimer);
    updateCaption('Welcome to Happylab. Live English subtitles appear here.');
    previewTimer = setTimeout(() => updateCaption(''), 10000);
  });
}

function secureWindow(window, allowedURL) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => {
    if (url !== allowedURL) event.preventDefault();
  });
  const role = window === controller ? 'controls' : 'overlay';
  window.webContents.on('render-process-gone', (_event, details) => {
    if (shuttingDown) return;
    diagnostic('renderer-gone', { role, reason: details.reason, exitCode: details.exitCode });
    if (window === controller) {
      controlsFailed = true;
      clearTimeout(previewTimer);
      updateCaption('');
      if (blocker !== undefined) { powerSaveBlocker.stop(blocker); blocker = undefined; }
    }
    if (details.reason !== 'clean-exit') dialog.showErrorBox('Live Translation',
      `The ${role} window stopped. Restart the app. Diagnostic log: ${logPath}`);
  });
  window.webContents.on('preload-error', (_event, _file, error) => diagnostic('preload-error', { role, name: error.name }));
  window.webContents.on('did-fail-load', (_event, code) => diagnostic('window-load-failed', { role, code }));
}

function showController() {
  if (shuttingDown || !windowAlive(controller)) return;
  if (controller.isMinimized()) controller.restore();
  controller.show();
  controller.focus();
}

async function boot() {
  diagnostic('app-ready');
  const envPath = path.join(app.isPackaged ? path.dirname(app.getPath('exe')) : app.getAppPath(), '.env');
  try { process.loadEnvFile(envPath); }
  catch (error) { if (error.code !== 'ENOENT') throw new Error('Could not read .env configuration'); }
  diagnostic('configuration-loaded', { apiKeyPresent: Boolean(process.env.OPENAI_API_KEY) });
  const { createApp } = await import(pathToFileURL(path.join(__dirname, '..', 'server.js')).href);
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  origin = `http://127.0.0.1:${server.address().port}`;
  diagnostic('local-server-listening');
  const all = screen.getAllDisplays();
  selectedDisplay = (all.find(d => d.id !== screen.getPrimaryDisplay().id) || all[0]).id;
  controller = new BrowserWindow({ width: 540, height: 820, minWidth: 440, minHeight: 650,
    title: 'Live Translation · Controls', backgroundColor: '#101113', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true,
      nodeIntegration: false, backgroundThrottling: false } });
  overlay = new BrowserWindow({ show: false, frame: false, transparent: true, backgroundColor: '#00000000',
    // macOS fullscreen apps occupy a separate Space. A non-activating panel
    // can join that Space without taking focus from the presentation.
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    alwaysOnTop: true, focusable: false, skipTaskbar: true, resizable: false, movable: false,
    hasShadow: false, fullscreenable: false,
    webPreferences: { preload: path.join(__dirname, 'overlay-preload.cjs'), contextIsolation: true,
      sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
  diagnostic('windows-created');
  overlay.setIgnoreMouseEvents(true);
  if (process.platform === 'darwin') overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  const session = controller.webContents.session;
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(!shuttingDown && windowAlive(controller) && contents === controller.webContents && contents.getURL() === `${origin}/` &&
      permission === 'media' && details.mediaTypes?.includes('audio') && !details.mediaTypes?.includes('video'));
  });
  session.setPermissionCheckHandler((contents, permission, requestingOrigin, details) =>
    !shuttingDown && windowAlive(controller) && contents === controller.webContents && allowsAudioCheck(permission, requestingOrigin, origin, details));
  installIPC();
  secureWindow(controller, `${origin}/`);
  const overlayURL = pathToFileURL(path.join(__dirname, 'overlay.html')).href;
  secureWindow(overlay, overlayURL);
  overlay.webContents.on('did-finish-load', positionOverlay);
  overlay.on('closed', () => { clearTimeout(previewTimer); overlay = null; });
  controller.on('close', () => { shuttingDown = true; clearTimeout(previewTimer); });
  controller.on('closed', () => app.quit());
  await controller.loadURL(`${origin}/`);
  if (shuttingDown) return;
  showController();
  diagnostic('controls-loaded');
  await overlay.loadURL(overlayURL);
  if (shuttingDown) return;
  diagnostic('overlay-loaded');
  for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.on(event, positionOverlay);
  const shortcuts = {
    'CommandOrControl+Alt+R': () => sendTo(controller, 'desktop:reconnect'),
    'CommandOrControl+Alt+U': () => { visible = !visible; positionOverlay(); },
    'CommandOrControl+Alt+C': showController,
  };
  for (const [key, callback] of Object.entries(shortcuts)) {
    if (!globalShortcut.register(key, callback)) console.warn(`Shortcut unavailable: ${key}`);
  }
  diagnostic(controlsFailed ? 'startup-incomplete' : 'startup-complete');
}

if (!app.requestSingleInstanceLock()) { diagnostic('existing-instance'); app.quit(); }
else {
  app.on('second-instance', () => { diagnostic('second-instance'); showController(); });
  app.whenReady().then(boot).catch(error => {
    if (shuttingDown) return;
    console.error('Desktop startup failed', { name: error.name });
    diagnostic('startup-failed', { name: error.name, code: error.code });
    dialog.showErrorBox('Live Translation', `Could not start the desktop app. Diagnostic log: ${logPath}`);
    app.quit();
  });
}
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { shuttingDown = true; clearTimeout(previewTimer); });
app.on('will-quit', () => {
  diagnostic('quitting');
  clearTimeout(previewTimer);
  if (app.isReady()) {
    for (const event of ['display-added', 'display-removed', 'display-metrics-changed']) screen.removeListener(event, positionOverlay);
  }
  // A second instance exits before ready, without registering shortcuts.
  // Electron rejects globalShortcut calls during that early shutdown.
  if (app.isReady()) globalShortcut.unregisterAll();
  if (blocker !== undefined) powerSaveBlocker.stop(blocker);
  server?.close();
});
