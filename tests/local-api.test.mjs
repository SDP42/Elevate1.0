import assert from "node:assert/strict";
import { test } from "node:test";
import http from "node:http";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import apiPlugin from "../vite.api-plugin.js";

test("local API adapter isolates routes, validates input and hides internal errors", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "elevate-api-"));
  await fs.mkdir(path.join(directory, "api"));
  await fs.writeFile(path.join(directory, "package.json"), '{"type":"module"}');
  await fs.writeFile(path.join(directory, "api/auth.js"), 'export default (req,res) => res.status(200).json({body:req.body ?? null});');
  await fs.writeFile(path.join(directory, "api/broken.js"), 'export default () => { throw new Error("private-database-secret"); };');
  const saved = Object.fromEntries(["DATABASE_URL", "POSTGRES_URL", "SESSION_SECRET"].map((key) => [key, process.env[key]]));
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  process.env.SESSION_SECRET = "local-test-secret";
  delete process.env.POSTGRES_URL;
  let middleware;
  apiPlugin().configureServer({ config: { root: directory }, middlewares: { use(fn) { middleware = fn; } } });
  const server = http.createServer((req, res) => middleware(req, res, () => { res.statusCode = 418; res.end(); }));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    await t.test("known handlers receive parsed bodies and query URLs", async () => {
      const response = await fetch(`${base}/api/auth?mode=test`, { method: "POST", body: '{"username":"test"}' });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.deepEqual(await response.json(), { body: { username: "test" } });
    });
    await t.test("unknown and private paths are inaccessible", async () => {
      for (const route of ["missing", "_lib/auth", "%2e%2e%2fdb%2fseed", "auth.js"]) {
        assert.equal((await fetch(`${base}/api/${route}`)).status, 404);
      }
    });
    await t.test("malformed JSON and non-object bodies return 400", async () => {
      for (const body of ["{broken", "null", "[]", '"text"']) {
        assert.equal((await fetch(`${base}/api/auth`, { method: "POST", body })).status, 400);
      }
    });
    await t.test("oversized payloads return 413", async () => {
      const response = await fetch(`${base}/api/auth`, { method: "POST", body: "x".repeat(1024 * 1024 + 1) });
      assert.equal(response.status, 413);
    });
    await t.test("configuration failure is distinguishable from a missing route", async () => {
      delete process.env.DATABASE_URL;
      const response = await fetch(`${base}/api/auth`);
      assert.equal(response.status, 503);
      assert.equal((await response.json()).code, "BACKEND_NOT_CONFIGURED");
      process.env.DATABASE_URL = "postgresql://test.invalid/test";
    });
    await t.test("handler failures never reveal internal error messages", async () => {
      const response = await fetch(`${base}/api/broken`);
      assert.equal(response.status, 500);
      assert.doesNotMatch(await response.text(), /private-database-secret/);
    });
    await t.test("non-API requests pass through", async () => {
      assert.equal((await fetch(`${base}/portal/login`)).status, 418);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await fs.rm(directory, { recursive: true, force: true });
  }
});
