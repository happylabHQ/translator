// Spellings from “20 Jahre Happylab – Moderationskarten 08.10.2026”, tab t.0:
// https://docs.google.com/document/d/1E4V1rq7d6rUxvtZg_-gFNG6WwQjxBspSFxjXVYLirmU/edit?tab=t.0
// This corrects displayed text only. It does not prime the translation model.
export const EVENT_TERMS = [
  { name: 'Happylab', aliases: ['Happy Lab', 'Happy-Lab', 'Happi Lab', 'Happilab'] },
  { name: 'Roland Stelzer', aliases: ['Roland Steltzer'] },
  { name: 'Karim Jafarmadar', aliases: ['Karim Jafar Madar', 'Karim Jafar-Madar'] },
  { name: 'Jafarmadar', aliases: ['Jafar Madar', 'Jafar-Madar'] },
  { name: 'Hörtlehner', aliases: ['Hoertlehner', 'Hortlehner'] },
  { name: 'Gordan Savicic', aliases: ['Gordan Savičić', 'Gordon Savicic'] },
  { name: 'Dale Dougherty', aliases: ['Dale Doherty', 'Dale Daugherty'] },
  { name: 'Lohwasser', aliases: ['Loh Wasser', 'Loh-Wasser'] },
  { name: 'Michael Schwantzer', aliases: ['Michael Schwanzer', 'Michael Schwantser'] },
  { name: 'Alexander Nikolai', aliases: ['Alexander Nicolai', 'Alexander Nikolay'] },
  // First-name variants must start with a capital letter. In particular,
  // ordinary English “happy”, “lab”, “make”, and “andy” are never rewritten.
  { name: 'Leyla', aliases: ['Layla', 'Laila'], caseSensitive: true },
  { name: 'Lukas', aliases: ['Lucas'], caseSensitive: true },
  { name: 'Michi', aliases: [], caseSensitive: true },
  { name: 'Gerhard', aliases: [], caseSensitive: true },
  { name: 'Silvia', aliases: ['Sylvia'], caseSensitive: true },
  { name: 'Andi', aliases: ['Andy'], caseSensitive: true },
  { name: 'Andreas', aliases: [], caseSensitive: true },
  { name: 'Herbert', aliases: [], caseSensitive: true },
  { name: 'Happy', aliases: [], caseSensitive: true },
  { name: 'ESPRIVA', aliases: ['ESP Riva', 'Es Priva'] },
  { name: 'Maker Faire', aliases: ['Maker Fair'] },
  { name: 'Young Makers Academy', aliases: ['Young Maker Academy'] },
  { name: 'Young Makers Club', aliases: ['Young Maker Club'] },
  { name: 'FFG', aliases: ['F F G'] },
];

function escape(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
}

const rules = EVENT_TERMS.map(term => ({
  name: term.name,
  pattern: new RegExp(`(?<![\\p{L}\\p{N}_])(?:${[term.name, ...term.aliases]
    .sort((a, b) => b.length - a.length).map(escape).join('|')})(?![\\p{L}\\p{N}_])`,
  term.caseSensitive ? 'gu' : 'giu'),
}));

export function normalizeTerms(text) {
  for (const rule of rules) text = text.replace(rule.pattern, () => rule.name);
  return text;
}
