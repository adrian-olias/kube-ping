// Settings from environment variables.
// In prod they come from the ConfigMap in helm-charts-wrappers; locally, from .env.
import { hostname } from "node:os";

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT ?? 8080),
    deployment: required(env, "DEPLOYMENT_NAME"), // the Deployment the card describes
    selector: required(env, "POD_SELECTOR"), // its pods
    namespace: env.NAMESPACE, // if unset, read from the ServiceAccount
    apiUrl: env.KUBE_API_URL, // only outside the cluster, e.g. `kubectl proxy`
    version: env.APP_VERSION ?? "dev", // set in the image by CI
    podName: hostname(), // Kubernetes sets the hostname to the pod name
    cacheMs: 2000,
    drainMs: Number(env.DRAIN_MS ?? 5000),
  };
}

// Fails at startup instead of running with a guessed value.
function required(env, name) {
  if (!env[name]) throw new Error(`${name} is required`);
  return env[name];
}
