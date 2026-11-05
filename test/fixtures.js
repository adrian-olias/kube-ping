// Builds Pod and Deployment objects shaped like the Kubernetes API returns them.

export function pod(name, { ready = true, terminating = false, created = "2026-11-05T09:00:00Z", restarts = 0 } = {}) {
  return {
    metadata: {
      name,
      creationTimestamp: created,
      ...(terminating ? { deletionTimestamp: "2026-11-05T09:59:59Z" } : {}),
    },
    status: {
      phase: "Running",
      conditions: [{ type: "Ready", status: ready ? "True" : "False" }],
      containerStatuses: [{ restartCount: restarts }],
    },
  };
}

export function deployment({ replicas = 2, readyReplicas = 2, resources, probes = true } = {}) {
  return {
    metadata: { name: "kube-ping", namespace: "kube-ping-prod" },
    spec: {
      replicas,
      template: {
        spec: {
          containers: [{
            name: "kube-ping",
            resources: resources ?? { requests: { cpu: "10m", memory: "32Mi" }, limits: { memory: "64Mi" } },
            ...(probes
              ? {
                readinessProbe: { httpGet: { path: "/readyz", port: "http" } },
                livenessProbe: { httpGet: { path: "/healthz", port: "http" } },
              }
              : {}),
          }],
        },
      },
    },
    status: { replicas, ...(readyReplicas ? { readyReplicas } : {}) },
  };
}
