import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.js';
import { Captions } from '../public/captions.js';

test('caption deltas preserve token spacing and only retain recent sentences', () => {
  const captions = new Captions();
  for (const delta of ['Welcome to Happy', 'lab. ', 'We use a laser', ' cutter. Next']) captions.append(delta);
  assert.equal(captions.previous, 'We use a laser cutter.');
  assert.equal(captions.current, 'Next');
  captions.append('x'.repeat(10000));
  assert.ok(captions.current.length <= 2000);
  captions.reset();
  assert.equal(captions.current, '');
  assert.equal(captions.previous, '');
});

async function withServer(options, callback) {
  const server = createApp(options).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await callback(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('session config uses translation endpoint and exposes only an ephemeral secret', async () => {
  await withServer({ apiKey: 'test-private-key', fetchOpenAI: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/realtime/translations/client_secrets');
    assert.equal(options.headers.Authorization, 'Bearer test-private-key');
    assert.equal(JSON.parse(options.body).session.audio.output.language, 'en');
    assert.equal(JSON.parse(options.body).session.model, 'gpt-realtime-translate');
    return Response.json({ value: 'ek_test', session: { private: 'omitted' } });
  } }, async url => {
    const response = await fetch(`${url}/session`, { method: 'POST' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { value: 'ek_test' });
    assert.equal((await fetch(`${url}/server.js`)).status, 404);
    assert.equal((await fetch(`${url}/.env`)).status, 404);
    assert.equal((await fetch(`${url}/session`, { method: 'POST', headers: { Origin: 'https://example.com' } })).status, 403);
  });
});

test('missing key and upstream errors produce safe actionable errors', async () => {
  await withServer({ apiKey: '' }, async url => {
    assert.equal((await fetch(`${url}/session`, { method: 'POST' })).status, 503);
    assert.equal((await fetch(url)).status, 200);
  });
  await withServer({ apiKey: 'test', fetchOpenAI: async () => new Response('private-provider-detail', { status: 401 }) }, async url => {
    const response = await fetch(`${url}/session`, { method: 'POST' });
    assert.equal(response.status, 502);
    assert.ok(!(await response.text()).includes('private-provider-detail'));
  });
});
