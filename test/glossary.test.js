import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTerms, EVENT_TERMS } from '../public/glossary.js';
import { fitSingleLine } from '../desktop/line.js';

test('event names and brands use spellings from the moderation cards', () => {
  assert.equal(normalizeTerms('Welcome to Happy Lab. Karim Jafar Madar and Roland Steltzer welcome Layla and Lucas.'),
    'Welcome to Happylab. Karim Jafarmadar and Roland Stelzer welcome Leyla and Lukas.');
  assert.equal(normalizeTerms('Herbert Hoertlehner, Gordan Savičić, Dale Doherty, Michael Schwanzer and Alexander Nicolai.'),
    'Herbert Hörtlehner, Gordan Savicic, Dale Dougherty, Michael Schwantzer and Alexander Nikolai.');
  assert.equal(normalizeTerms('Loh Wasser, Sylvia, Andy, ESP Riva, Maker Fair and Young Maker Academy.'),
    'Lohwasser, Silvia, Andi, ESPRIVA, Maker Faire and Young Makers Academy.');
  for (const term of EVENT_TERMS) assert.equal(normalizeTerms(term.name), term.name);
});

test('normal words, larger words and unsupported guesses are preserved', () => {
  const text = "We are happy to make a lab. Happy Birthday! Happy Labyrinth. Karim Jafar's project. A different person: John Doherty.";
  assert.equal(normalizeTerms(text), text);
});

test('display corrections converge across every delta split without mutating source', () => {
  const source = 'Welcome to Happy Lab with Karim Jafar Madar and Dale Doherty.';
  const expected = 'Welcome to Happylab with Karim Jafarmadar and Dale Dougherty.';
  for (let split = 0; split <= source.length; split++) {
    let raw = source.slice(0, split);
    normalizeTerms(raw);
    raw += source.slice(split);
    assert.equal(normalizeTerms(raw), expected);
  }
  let raw = 'Happy Lab';
  assert.equal(normalizeTerms(raw), 'Happylab');
  raw += 'yrinth';
  assert.equal(normalizeTerms(raw), 'Happy Labyrinth');
});

test('overlay width uses corrected text and retains the original visible tail', () => {
  const raw = fitSingleLine('Welcome to Happy Lab', 14, value => normalizeTerms(value).length);
  assert.equal(raw, 'to Happy Lab');
  assert.equal(normalizeTerms(raw), 'to Happylab');
});
