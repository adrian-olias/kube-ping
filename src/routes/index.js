// Path → HTTP method → controller.
// Traefik sends /api/ping/* here; the probes reach the pod directly.
export function createRoutes({ health, ping, deployment }) {
  return {
    "/healthz": { GET: health.live },
    "/readyz": { GET: health.ready },
    "/api/ping": { GET: ping.ping },
    "/api/ping/deployment": { GET: deployment.get },
  };
}
