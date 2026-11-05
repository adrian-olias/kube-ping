// The whole API over HTTP, with a fake Kubernetes service behind it.
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/server.js";
import { deployment, pod } from "./fixtures.js";

const fake = { down: false };
const kubernetes = {
  getDeployment: async () => {
    if (fake.down) throw new Error("GET returned 500");
    return deployment();
  },
  listPods: async () => [pod("kube-ping-a")],
};

const lifecycle = { draining: false };
const logs = [];
let server;
let base;
before(async () => {
  const config = {
    namespace: "kube-ping-prod",
    deployment: "kube-ping",
    selector: "app=x",
    cacheMs: 0,
    podName: "kube-ping-7c8d9f-x2k9p",
    version: "0.1.0",
  };
  server = createApp({ config, kubernetes, lifecycle, log: (l) => logs.push(l) });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("GET /api/ping answers with the pod, the version and the app's time", async () => {
  const res = await fetch(`${base}/api/ping`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("cache-control"), "no-store");

  const body = await res.json();
  assert.equal(body.pod, "kube-ping-7c8d9f-x2k9p");
  assert.equal(body.version, "0.1.0");
  assert.ok(body.processingMs >= 0 && body.processingMs < 1000);
  assert.equal(res.headers.get("server-timing"), `app;dur=${body.processingMs}`);
});

test("GET /api/ping/deployment describes the live Deployment", async () => {
  const res = await fetch(`${base}/api/ping/deployment`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.name, "kube-ping");
  assert.deepEqual(body.pods, [{ name: "kube-ping-a", ready: true, restarts: 0 }]);
});

test("a Kubernetes API failure is a 503 and doesn't stop the ping", async () => {
  fake.down = true;
  try {
    const res = await fetch(`${base}/api/ping/deployment`);
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { error: "cluster unavailable" });
    assert.equal(logs.at(-1).msg, "request failed");
    assert.equal((await fetch(`${base}/api/ping`)).status, 200);
  } finally {
    fake.down = false;
  }
});

test("/readyz turns 503 while draining; /healthz stays 200", async () => {
  assert.equal((await fetch(`${base}/readyz`)).status, 200);
  lifecycle.draining = true;
  try {
    assert.equal((await fetch(`${base}/readyz`)).status, 503);
    assert.equal((await fetch(`${base}/healthz`)).status, 200);
  } finally {
    lifecycle.draining = false;
  }
});

test("unknown paths are 404 and wrong methods 405", async () => {
  assert.equal((await fetch(`${base}/api/ping/nope`)).status, 404);
  assert.equal((await fetch(`${base}/constructor`)).status, 404);
  const res = await fetch(`${base}/api/ping`, { method: "POST" });
  assert.equal(res.status, 405);
  assert.equal(res.headers.get("allow"), "GET");
});
