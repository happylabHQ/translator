import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSingleLine } from '../desktop/line.js';
import { OverlayCaptions } from '../desktop/captions.js';

test('one-line overlay keeps recent whole words at a fixed text size', () => {
  assert.equal(fitSingleLine('Welcome to Happylab', 10, text => text.length), 'Happylab');
  assert.equal(fitSingleLine('Hello\nworld', 30, text => text.length), 'Hello world');
  assert.equal(fitSingleLine('Hello ', 30, text => text.length), 'Hello ');
  assert.equal(fitSingleLine('Superlongword', 4, text => text.length), 'word');
  assert.equal(fitSingleLine('Anything', 0, text => text.length), '');
});

test('two-row overlay keeps completed text above the live phrase', () => {
  const captions = new OverlayCaptions();
  captions.append('Welcome to Happylab. ');
  assert.deepEqual(captions.layout(30, text => text.length), { previous: 'Welcome to Happylab.', current: '' });
  captions.append('Leyla and ');
  assert.deepEqual(captions.layout(30, text => text.length), { previous: 'Welcome to Happylab.', current: 'Leyla and' });
  captions.append('Andi welcome you. Next');
  assert.deepEqual(captions.layout(30, text => text.length), { previous: 'Leyla and Andi welcome you.', current: 'Next' });
  captions.reset();
  assert.deepEqual(captions.layout(30, text => text.length), { previous: '', current: '' });
});

test('full rows advance in word blocks rather than dropping each oldest word', () => {
  const captions = new OverlayCaptions();
  captions.append('one two three');
  assert.deepEqual(captions.layout(11, text => text.length), { previous: 'one two', current: 'three' });
  captions.append(' four');
  assert.deepEqual(captions.layout(11, text => text.length), { previous: 'one two', current: 'three four' });
  captions.append(' five');
  assert.deepEqual(captions.layout(11, text => text.length), { previous: 'three four', current: 'five' });
  captions.append('x'.repeat(10000));
  const rows = captions.layout(11, text => text.length);
  assert.ok(rows.previous.length <= 11 && rows.current.length <= 11);
  assert.deepEqual(captions.layout(0, text => text.length), { previous: '', current: '' });
});
