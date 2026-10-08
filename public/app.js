import { Captions } from './captions.js';
import { normalizeTerms } from './glossary.js';
window.desktop?.diagnostic('controls-script-started');

const setup = document.querySelector('#setup');
const screen = document.querySelector('#subtitle-screen');
const input = document.querySelector('#audio-input');
const audioRefresh = document.querySelector('#audio-refresh');
const startButton = document.querySelector('#start');
const reconnectButton = document.querySelector('#reconnect');
const previous = document.querySelector('#previous');
const current = document.querySelector('#current');
const captionsElement = document.querySelector('#captions');
const captions = new Captions();
const desktop = window.desktop;
let desktopCaption = '';
let connection = null;
let busy = false;
let selectedDevice = '';
let deviceRequest = null;
let renderTimer;
let controlsTimer;
let audioInitialized = false;
function status(state, message = '') {
  document.body.dataset.status = state;
  document.querySelectorAll('[data-status-label]').forEach(el => { el.textContent = state; });
  document.querySelectorAll('[data-error]').forEach(el => { el.textContent = message; });
  if (desktop) {
    desktop.status(state);
    document.querySelector('#overlay-preview').disabled = state === 'Connecting' || state === 'Connected';
    document.querySelector('#desktop-stop').disabled = !connection;
    input.disabled = state === 'Connecting' || state === 'Connected';
    audioRefresh.disabled = busy || Boolean(connection) || Boolean(deviceRequest);
    if (!busy) startButton.disabled = state === 'Connected';
  }
}

async function listDevices() {
  audioInitialized = true;
  desktop?.diagnostic('devices-query-started');
  const selected = input.value;
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audioinput');
  input.replaceChildren(new Option('Default microphone', ''));
  devices.forEach((device, index) => input.add(new Option(device.label || `Audio input ${index + 1}`, device.deviceId)));
  if (devices.some(d => d.deviceId === selected)) input.value = selected;
  audioRefresh.textContent = 'Refresh microphones';
  desktop?.diagnostic('devices-query-complete');
}

// Device labels are private until microphone permission has been granted.
function discoverDevices() {
  if (deviceRequest || busy) return;
  if (desktop) audioRefresh.disabled = true;
  deviceRequest = (async () => {
    let stream;
    try {
      desktop?.diagnostic('microphone-request-started');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      desktop?.diagnostic('microphone-request-granted');
      await listDevices();
      status('Idle');
    } catch (error) {
      console.error('Microphone discovery failed', { name: error.name });
      status('Error', microphoneError(error));
    } finally {
      stream?.getTracks().forEach(track => track.stop());
    }
  })().finally(() => {
    deviceRequest = null;
    if (desktop) audioRefresh.disabled = busy || Boolean(connection);
  });
}

function microphoneError(error) {
  if (error.name === 'NotAllowedError') return 'Microphone access denied';
  if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'Selected audio input is unavailable';
  if (error.name === 'NotReadableError') return 'Audio input is busy or unavailable';
  return 'Could not open microphone';
}

function closeConnection() {
  if (desktop) {
    clearTimeout(renderTimer);
    renderTimer = null;
    desktopCaption = '';
    desktop.caption('');
  }
  const old = connection;
  connection = null;
  if (!old) return;
  clearTimeout(old.timeout);
  old.rejectReady?.(new Error('Connection closed'));
  old.abort.abort();
  old.channel?.close();
  old.peer?.close();
  old.stream?.getTracks().forEach(track => track.stop());
  old.wake?.release().catch(() => {});
}

function lost(context, message = 'Connection lost') {
  if (connection !== context) return;
  context.rejectReady?.(new Error(message));
  closeConnection();
  status('Disconnected', message);
  console.info('disconnected');
  showControls();
}

function fitText(element, text, lines) {
  // Use browser layout, so three lines remain three lines on any projector.
  const maxHeight = parseFloat(getComputedStyle(captionsElement).lineHeight) * lines + 1;
  element.textContent = normalizeTerms(text);
  while (element.offsetHeight > maxHeight && text.length) {
    const space = text.indexOf(' ');
    text = space >= 0 ? text.slice(space + 1) : text.slice(1);
    element.textContent = normalizeTerms(text);
  }
  return text;
}

function renderCaptions() {
  clearTimeout(renderTimer);
  renderTimer = null;
  if (desktop) {
    if (desktopCaption) desktop.delta(desktopCaption);
    desktopCaption = '';
    return;
  }
  if (screen.hidden) return;
  // Two fixed text containers; never rebuild the caption DOM or keep history.
  const hasCurrent = Boolean(captions.current.trim());
  fitText(previous, captions.previous, hasCurrent ? 1 : 3);
  const currentLines = previous.textContent ? 2 : 3;
  captions.current = fitText(current, captions.current.trimStart(), currentLines);
}

function receive(context, data) {
  if (connection !== context) return;
  try {
    const event = JSON.parse(data);
    if (event.type === 'session.output_transcript.delta' && typeof event.delta === 'string') {
      if (desktop) desktopCaption = (desktopCaption + event.delta).slice(-2000);
      else captions.append(event.delta);
      if (!renderTimer) renderTimer = setTimeout(renderCaptions, 80);
    } else if (event.type === 'session.created') {
      console.info('session created');
    } else if (event.type === 'session.closed') {
      lost(context, 'Session ended. Reconnect to continue.');
    } else if (event.type === 'error') {
      console.error('Realtime error', { type: event.error?.type, code: event.error?.code, param: event.error?.param });
      context.rejectReady?.(new Error('OpenAI session error. Reconnect to continue.'));
      closeConnection();
      status('Error', 'OpenAI session error. Reconnect to continue.');
      showControls();
    }
  } catch (error) {
    console.error('Invalid Realtime event', { name: error.name });
  }
}

async function connect() {
  if (busy) return;
  busy = true;
  if (desktop) document.querySelector('#desktop-reconnect').disabled = true;
  startButton.disabled = reconnectButton.disabled = true;
  await deviceRequest;
  if (screen.hidden) selectedDevice = input.value;
  closeConnection();
  captions.reset();
  desktopCaption = '';
  desktop?.caption('');
  previous.textContent = current.textContent = '';
  const context = { abort: new AbortController() };
  connection = context;
  status('Connecting');
  console.info('connecting');
  let phase = 'microphone';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone requires HTTPS or localhost');
    desktop?.diagnostic('microphone-request-started');
    context.stream = await navigator.mediaDevices.getUserMedia({
      audio: selectedDevice ? { deviceId: { exact: selectedDevice } } : true,
    });
    desktop?.diagnostic('microphone-request-granted');
    if (connection !== context) { context.stream.getTracks().forEach(track => track.stop()); return; }
    await listDevices();
    phase = 'connection';
    context.timeout = setTimeout(() => {
      context.abort.abort();
      context.rejectReady?.(new Error('Connection timed out'));
    }, 30000);
    const sessionResponse = await fetch('/session', { method: 'POST', signal: context.abort.signal });
    const session = await sessionResponse.json();
    if (!sessionResponse.ok) throw new Error(session.error || 'Could not connect to OpenAI');
    const peer = context.peer = new RTCPeerConnection();
    const channel = context.channel = peer.createDataChannel('oai-events');
    channel.onmessage = ({ data }) => receive(context, data);
    // Do not attach the remote track to an audio element: captions only.
    const track = context.stream.getAudioTracks()[0];
    track.onended = () => lost(context, 'Audio input disconnected');
    peer.addTrack(track, context.stream);
    const ready = new Promise((resolve, reject) => {
      context.rejectReady = reject;
      const check = () => {
        if (connection !== context) return;
        if (peer.connectionState === 'connected' && channel.readyState === 'open') resolve();
        else if (['failed', 'disconnected', 'closed'].includes(peer.connectionState)) lost(context);
      };
      peer.onconnectionstatechange = check;
      channel.onopen = check;
      channel.onclose = () => lost(context);
      channel.onerror = () => lost(context);
    });
    // Attach a handler immediately; readiness can fail during the SDP request.
    ready.catch(() => {});
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    const answer = await fetch('https://api.openai.com/v1/realtime/translations/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.value}`, 'Content-Type': 'application/sdp' },
      body: offer.sdp,
      signal: context.abort.signal,
    });
    if (!answer.ok) {
      console.error('OpenAI WebRTC handshake failed', { status: answer.status });
      throw new Error('Could not connect to OpenAI');
    }
    await peer.setRemoteDescription({ type: 'answer', sdp: await answer.text() });
    await ready;
    if (connection !== context) return;
    clearTimeout(context.timeout);
    context.rejectReady = null;
    setup.hidden = !desktop;
    screen.hidden = Boolean(desktop);
    status('Connected');
    renderCaptions();
    console.info('connected');
    showControls();
    requestWake(context);
  } catch (error) {
    console.error('Connection failed', { phase, name: error.name });
    if (connection === context) {
      closeConnection();
      status('Error', phase === 'microphone' ? (error.message === 'Microphone requires HTTPS or localhost' ? error.message : microphoneError(error))
        : error.name === 'AbortError' ? 'Connection timed out. Try again.' : error.message);
      showControls();
    }
  } finally {
    busy = false;
    startButton.disabled = Boolean(desktop && connection);
    reconnectButton.disabled = false;
    if (desktop) document.querySelector('#desktop-reconnect').disabled = false;
    if (desktop) audioRefresh.disabled = Boolean(connection);
  }
}

async function requestWake(context) {
  if (!navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    const lock = await navigator.wakeLock.request('screen');
    if (connection === context) context.wake = lock;
    else await lock.release();
  } catch { /* Optional: unsupported browsers still translate normally. */ }
}

function showControls() {
  document.body.classList.add('controls-visible');
  clearTimeout(controlsTimer);
  controlsTimer = setTimeout(() => document.body.classList.remove('controls-visible'), 3000);
}

async function fullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    console.error('Fullscreen failed', { name: error.name });
    document.querySelector('#subtitle-screen [data-error]').textContent = 'Fullscreen unavailable. Use your browser’s fullscreen command.';
  }
}

document.querySelector('#setup-form').addEventListener('submit', event => { event.preventDefault(); connect(); });
input.addEventListener('focus', () => { if (!desktop) discoverDevices(); });
// Native windows can focus their first form field automatically. Focus alone
// must not initialize audio before the presenter explicitly opens the selector.
input.addEventListener('pointerdown', () => { if (desktop && !audioInitialized) discoverDevices(); });
input.addEventListener('keydown', event => {
  if (desktop && !audioInitialized && ['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(event.key)) discoverDevices();
});
reconnectButton.addEventListener('click', connect);
document.querySelector('#fullscreen').addEventListener('click', fullscreen);
document.addEventListener('pointermove', showControls);
document.addEventListener('pointerdown', showControls);
document.addEventListener('keydown', event => {
  if (screen.hidden || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
  showControls();
  if (event.key.toLowerCase() === 'f') { event.preventDefault(); fullscreen(); }
  if (event.key.toLowerCase() === 'r') { event.preventDefault(); connect(); }
});
window.addEventListener('resize', renderCaptions);
window.addEventListener('pagehide', closeConnection);
document.addEventListener('visibilitychange', () => {
  if (connection && document.visibilityState === 'visible') requestWake(connection);
});
if (navigator.mediaDevices) {
  // Some Windows audio drivers fail during eager device discovery. In desktop
  // mode, initialize audio only when the user opens the selector or clicks Start.
  if (!desktop) listDevices().catch(error => console.error('Device listing failed', { name: error.name }));
  navigator.mediaDevices.addEventListener('devicechange', () => {
    if (desktop && !audioInitialized) return;
    listDevices().catch(error => console.error('Device listing failed', { name: error.name }));
  });
} else status('Error', 'Microphone requires HTTPS or localhost');

if (desktop) {
  document.body.classList.add('desktop-mode');
  audioRefresh.hidden = false;
  audioRefresh.addEventListener('click', discoverDevices);
  document.querySelector('#desktop-options').hidden = false;
  const displayInput = document.querySelector('#overlay-display');
  const sizeInput = document.querySelector('#overlay-size');
  const offsetInput = document.querySelector('#overlay-bottom');
  const visibilityButton = document.querySelector('#overlay-toggle');
  let overlayVisible = true;
  function applySettings(value) {
    if (!value) return;
    displayInput.replaceChildren(...value.displays.map(d => new Option(d.label, d.id)));
    displayInput.value = String(value.displayId);
    sizeInput.value = value.fontSize;
    offsetInput.value = value.bottom;
    overlayVisible = value.visible;
    visibilityButton.textContent = value.visible ? 'Hide overlay' : 'Show overlay';
  }
  function configure(extra = {}) {
    desktop.configure({ displayId: Number(displayInput.value), fontSize: Number(sizeInput.value),
      bottom: Number(offsetInput.value), ...extra }).then(applySettings)
      .catch(error => console.error('Overlay configuration failed', { name: error.name }));
  }
  desktop.onSettings(applySettings);
  desktop.settings().then(applySettings).catch(error => console.error('Display listing failed', { name: error.name }));
  for (const element of [displayInput, sizeInput, offsetInput]) element.addEventListener('change', () => configure());
  visibilityButton.addEventListener('click', () => configure({ visible: !overlayVisible }));
  document.querySelector('#overlay-preview').addEventListener('click', () => { if (!connection && !busy) desktop.preview(); });
  document.querySelector('#desktop-reconnect').addEventListener('click', connect);
  document.querySelector('#desktop-stop').addEventListener('click', () => {
    closeConnection();
    desktopCaption = '';
    captions.reset();
    status('Idle');
    startButton.disabled = busy;
  });
  desktop.onReconnect(connect);
  desktop.diagnostic('controls-script-ready');
}
