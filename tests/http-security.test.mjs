import assert from 'node:assert/strict';
import { test } from 'node:test';
import { secureHandler } from '../api/_lib/http.js';

const response = () => ({ headers: {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; }, setHeader(key, value) { this.headers[key] = value; } });
test('mutations reject foreign origins and cross-site requests', async () => {
  for (const headers of [{ host: 'example.com', origin: 'https://evil.example' }, { host: 'example.com', 'sec-fetch-site': 'cross-site' }]) {
    const res = response();
    await secureHandler(() => { throw new Error('must not execute'); })({ method: 'POST', headers }, res);
    assert.equal(res.statusCode, 403);
  }
});
test('same-origin requests work and private replies cannot be cached', async () => {
  const res = response();
  await secureHandler((req, res) => res.status(200).json({ ok: true }))({ method: 'POST', headers: { host: 'example.com', origin: 'https://example.com' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['Cache-Control'], 'private, no-store');
});
test('internal failures are redacted', async () => {
  const res = response();
  await secureHandler(() => { throw new Error('private-secret'); })({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 500);
  assert.ok(!JSON.stringify(res.body).includes('private-secret'));
});
