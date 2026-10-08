import express from 'express';
import { fileURLToPath } from 'node:url';

export function createApp({ apiKey = process.env.OPENAI_API_KEY, fetchOpenAI = fetch } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Permissions-Policy', 'microphone=(self)');
    next();
  });
  app.post('/session', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    // Local application: reject cross-origin requests without adding a login.
    if (req.get('Sec-Fetch-Site') === 'cross-site' ||
        (req.get('Origin') && req.get('Origin') !== `${req.protocol}://${req.get('host')}`)) {
      return res.status(403).json({ error: 'Request origin not allowed' });
    }
    if (!apiKey) return res.status(503).json({ error: 'Set OPENAI_API_KEY in .env and restart the server' });
    try {
      console.info('Creating translation session');
      const response = await fetchOpenAI('https://api.openai.com/v1/realtime/translations/client_secrets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expires_after: { anchor: 'created_at', seconds: 60 },
          session: { model: 'gpt-realtime-translate', audio: { output: { language: 'en' } } },
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        // Never log full provider responses: they may contain sensitive data.
        console.error('OpenAI API error', { status: response.status, requestId: response.headers.get('x-request-id') });
        return res.status(502).json({ error: 'Could not create OpenAI session. Check API key and model access.' });
      }
      const data = await response.json();
      if (typeof data.value !== 'string' || !data.value.startsWith('ek_')) throw new Error('Invalid client secret response');
      console.info('Translation session created');
      res.json({ value: data.value });
    } catch (error) {
      console.error('Session creation failed', { name: error.name, message: 'OpenAI request failed or returned an invalid response' });
      res.status(502).json({ error: 'Could not connect to OpenAI' });
    }
  });
  app.use(express.static(fileURLToPath(new URL('./public/', import.meta.url))));
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, '127.0.0.1', () => console.info(`Live Translation: http://localhost:${port}`));
}
