function allowsAudioCheck(permission, requestingOrigin, controllerOrigin, details = {}) {
  if (permission !== 'media' || (details.mediaType !== undefined && details.mediaType !== 'audio')) return false;
  try {
    return new URL(requestingOrigin).origin === controllerOrigin;
  } catch {
    return false;
  }
}

module.exports = { allowsAudioCheck };
