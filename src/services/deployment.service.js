// Data for "Inspect deployment": what the Deployment asks for and what runs.
import { byAge, toPodView } from "../models/pod.model.js";

// Everything comes from the live objects, so the card shows what is really
// configured. A value that isn't set is null (e.g. no CPU limit), never a default.
export function summarize(deployment, pods) {
  const container = deployment.spec?.template?.spec?.containers?.[0] ?? {};
  const quantities = (set) => ({ cpu: set?.cpu ?? null, memory: set?.memory ?? null });
  const probe = (p) => p?.httpGet?.path ?? null;

  return {
    name: deployment.metadata.name,
    namespace: deployment.metadata.namespace,
    replicas: deployment.spec?.replicas ?? 1,
    readyReplicas: deployment.status?.readyReplicas ?? 0,
    pods: [...pods].sort(byAge).map(toPodView),
    resources: {
      requests: quantities(container.resources?.requests),
      limits: quantities(container.resources?.limits),
    },
    probes: {
      readiness: probe(container.readinessProbe),
      liveness: probe(container.livenessProbe),
    },
  };
}

export function createDeploymentService({ kubernetes, namespace, deployment, selector, cacheMs, now }) {
  // Several visitors may look at once, so one answer is shared for cacheMs to spare the API server.
  let cached = null;

  return {
    snapshot() {
      if (cached && now() - cached.at < cacheMs) return cached.promise;

      const promise = Promise.all([
        kubernetes.getDeployment(namespace, deployment),
        kubernetes.listPods(namespace, selector),
      ]).then(([d, pods]) => summarize(d, pods));

      cached = { at: now(), promise };
      // Don't keep a failed answer.
      promise.catch(() => {
        if (cached?.promise === promise) cached = null;
      });
      return promise;
    },
  };
}
