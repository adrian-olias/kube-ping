// GET /healthz and /readyz, for the probes. Neither calls Kubernetes, so a
// slow API server can't get healthy pods restarted or taken out of the Service.
//
// /healthz: the process is up. If it fails, the kubelet restarts the container.
// /readyz:  the pod takes traffic. It fails while the pod shuts down, so it
//           leaves the Service while it still answers the requests in flight.
export function createHealthController({ lifecycle }) {
  return {
    live: async () => ({ status: 200, body: { ok: true } }),
    ready: async () => (lifecycle.draining
      ? { status: 503, body: { ok: false, reason: "shutting down" } }
      : { status: 200, body: { ok: true } }),
  };
}
