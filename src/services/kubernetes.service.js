// The Kubernetes API calls the app needs: read its Deployment and list its pods.
//
// In the cluster it authenticates with the pod's ServiceAccount token, and
// trusts the cluster CA through NODE_EXTRA_CA_CERTS (set in the Dockerfile).
// With apiUrl, e.g. `kubectl proxy`, the proxy handles authentication.
import { readFileSync } from "node:fs";

const SA_DIR = "/var/run/secrets/kubernetes.io/serviceaccount";

export function createKubernetesService({ apiUrl, timeoutMs = 5000 } = {}) {
  const baseUrl = apiUrl ?? `https://${process.env.KUBERNETES_SERVICE_HOST}:${process.env.KUBERNETES_SERVICE_PORT}`;

  async function get(path) {
    const headers = { Accept: "application/json" };
    // The token rotates, so it's read on every call.
    if (!apiUrl) headers.Authorization = `Bearer ${readFileSync(`${SA_DIR}/token`, "utf8").trim()}`;

    const res = await fetch(new URL(path, baseUrl), { headers, signal: AbortSignal.timeout(timeoutMs) });
    if (res.status !== 200) throw new Error(`GET ${path} returned ${res.status}`);
    return res.json();
  }

  return {
    getDeployment: (namespace, name) =>
      get(`/apis/apps/v1/namespaces/${namespace}/deployments/${encodeURIComponent(name)}`),
    listPods: async (namespace, selector) =>
      (await get(`/api/v1/namespaces/${namespace}/pods?labelSelector=${encodeURIComponent(selector)}`)).items,
  };
}

export function inClusterNamespace() {
  return readFileSync(`${SA_DIR}/namespace`, "utf8").trim();
}
