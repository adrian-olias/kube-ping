// Minimal HTTP helpers on top of node:http.

export function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

// Builds the request handler from the route table: path → method → controller.
// Controllers get { receivedAt } (performance.now() when the request arrived)
// and return { status, body, headers }.
// Unknown path → 404, wrong method → 405, any error → 503.
export function createRouter(routes, { log, clock = () => performance.now() }) {
  return async (req, res) => {
    const receivedAt = clock();
    const { pathname } = new URL(req.url, "http://localhost");
    const methods = Object.hasOwn(routes, pathname) ? routes[pathname] : null;
    if (!methods) return sendJson(res, 404, { error: "not found" });

    const controller = methods[req.method];
    if (!controller) {
      return sendJson(res, 405, { error: "method not allowed" }, { Allow: Object.keys(methods).join(", ") });
    }

    try {
      const { status, body, headers } = await controller({ receivedAt });
      sendJson(res, status, body, headers);
    } catch (err) {
      // Only the Kubernetes API can fail like this.
      log({ msg: "request failed", path: pathname, error: err.message });
      sendJson(res, 503, { error: "cluster unavailable" });
    }
  };
}
