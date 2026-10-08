import { OverlayCaptions } from './captions.js';
import { normalizeTerms } from '../public/glossary.js';
const line = document.querySelector('#line');
const previous = document.querySelector('#previous');
const current = document.querySelector('#current');
const canvas = document.createElement('canvas');
const context = canvas.getContext('2d');
const captions = new OverlayCaptions();
let fontSize = 48;
let timer;
const idleDelay = 8000;
let idleTimer;
function render() {
  clearTimeout(timer);
  timer = null;
  line.style.fontSize = `${fontSize}px`;
  context.font = getComputedStyle(line).font;
  const rows = captions.layout(Math.max(0, window.innerWidth - 36), value => context.measureText(normalizeTerms(value)).width);
  previous.textContent = normalizeTerms(rows.previous);
  current.textContent = normalizeTerms(rows.current);
  line.hidden = !rows.previous && !rows.current;
}
window.overlay.onCaption(value => {
  const hasNewText = (typeof value.text === 'string' && value.text.trim()) ||
    (typeof value.delta === 'string' && value.delta.trim());
  if (typeof value.text === 'string') { captions.reset(); captions.append(value.text.slice(-2000)); }
  if (typeof value.delta === 'string') captions.append(value.delta.slice(-2000));
  if (hasNewText) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // Start the next spoken passage fresh rather than reviving old subtitles.
      captions.reset();
      render();
    }, idleDelay);
  } else if (!captions.previous && !captions.current) {
    clearTimeout(idleTimer);
  }
  if (Number.isFinite(value.fontSize)) fontSize = value.fontSize;
  if (!captions.previous && !captions.current) render();
  else if (!timer) timer = setTimeout(render, 80);
});
window.addEventListener('resize', render);
