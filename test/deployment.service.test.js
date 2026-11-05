import assert from "node:assert/strict";
import { test } from "node:test";
import { createDeploymentService, summarize } from "../src/services/deployment.service.js";
import { deployment, pod } from "./fixtures.js";

test("summarize shows the live settings and the pods, oldest first", () => {
  const pods = [
    pod("kube-ping-b", { created: "2026-11-05T09:30:00Z", restarts: 1 }),
    pod("kube-ping-a"),
  ];
  assert.deepEqual(summarize(deployment(), pods), {
    name: "kube-ping",
    namespace: "kube-ping-prod",
    replicas: 2,
    readyReplicas: 2,
    pods: [
      { name: "kube-ping-a", ready: true, restarts: 0 },
      { name: "kube-ping-b", ready: true, restarts: 1 },
    ],
    resources: {
      requests: { cpu: "10m", memory: "32Mi" },
      limits: { cpu: null, memory: "64Mi" },
    },
    probes: { readiness: "/readyz", liveness: "/healthz" },
  });
});

test("what isn't set is null, not a guessed default", () => {
  const view = summarize(deployment({ readyReplicas: 0, resources: {}, probes: false }), [
    pod("kube-ping-a", { ready: false }),
    pod("kube-ping-b", { terminating: true }),
  ]);
  assert.equal(view.readyReplicas, 0);
  assert.deepEqual(view.resources, { requests: { cpu: null, memory: null }, limits: { cpu: null, memory: null } });
  assert.deepEqual(view.probes, { readiness: null, liveness: null });
  assert.deepEqual(view.pods.map((p) => p.ready), [false, false]);
});

test("one answer is shared for cacheMs, and a failure is not cached", async () => {
  let calls = 0;
  let down = true;
  const kubernetes = {
    getDeployment: async () => {
      calls++;
      if (down) throw new Error("GET returned 500");
      return deployment();
    },
    listPods: async () => [],
  };
  const clock = { t: 0 };
  const service = createDeploymentService({ kubernetes, cacheMs: 2000, now: () => clock.t });

  await assert.rejects(service.snapshot());
  down = false;
  await service.snapshot();
  await service.snapshot();
  assert.equal(calls, 2);

  clock.t += 2000;
  await service.snapshot();
  assert.equal(calls, 3);
});
