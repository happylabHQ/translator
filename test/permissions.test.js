import test from 'node:test';
import assert from 'node:assert/strict';
import permissions from '../desktop/permissions.cjs';

test('audio enumeration accepts Electron URL format only for the controller origin', () => {
  const origin = 'http://127.0.0.1:52742';
  const check = (url, type = 'audio', permission = 'media') =>
    permissions.allowsAudioCheck(permission, url, origin, { mediaType: type });
  assert.equal(check(`${origin}/`), true);
  assert.equal(check(origin), true);
  assert.equal(permissions.allowsAudioCheck('media', `${origin}/`, origin), true);
  assert.equal(check(`${origin}/`, 'video'), false);
  assert.equal(check(`${origin}/`, 'audio', 'speaker-selection'), false);
  assert.equal(check('http://127.0.0.1:52743/'), false);
  assert.equal(check('https://example.com/'), false);
  assert.equal(check('file:///tmp/overlay.html'), false);
  assert.equal(check('invalid URL'), false);
});
