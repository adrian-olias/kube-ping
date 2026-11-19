// Builds the app (services → controllers → routes) and, when run directly, starts it.
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { createDeploymentController } from "./controllers/deployment.controller.js";
import { createHealthController } from "./controllers/health.controller.js";
import { createPingController } from "./controllers/ping.controller.js";
import { createRoutes } from "./routes/index.js";
import { createDeploymentService } from "./services/deployment.service.js";
import { createKubernetesService, inClusterNamespace } from "./services/kubernetes.service.js";
import { createRouter } from "./utils/http.js";
import { createStaticHandler } from "./utils/static.js";

// Logs one JSON object per line.
const jsonLog = (fields) => console.log(JSON.stringify(fields));

// lifecycle.draining turns /readyz to 503 during shutdown.
export function createApp({ config, kubernetes, lifecycle = { draining: false }, now = Date.now, log = jsonLog }) {
  const { namespace, deployment, selector, cacheMs, podName, version } = config;

  const routes = createRoutes({
    health: createHealthController({ lifecycle }),
    ping: createPingController({ podName, version }),
    deployment: createDeploymentController({
      deploymentService: createDeploymentService({ kubernetes, namespace, deployment, selector, cacheMs, now }),
    }),
  });

  // Paths the API doesn't know are the page and its assets, under /kube-ping and /es/kube-ping.
  return createServer(createRouter(routes, { log, fallback: createStaticHandler() }));
}

function start() {
  const config = loadConfig();
  config.namespace ??= inClusterNamespace();

  const lifecycle = { draining: false };
  const server = createApp({ config, lifecycle, kubernetes: createKubernetesService({ apiUrl: config.apiUrl }) });
  server.listen(config.port, () =>
    jsonLog({ msg: "listening", port: config.port, pod: config.podName, version: config.version }));

  // Kubernetes sends SIGTERM and, at the same time, starts taking the pod out
  // of the Service. The pod keeps answering for drainMs, so requests Traefik
  // still sends here don't fail, then closes once the requests in flight end.
  process.on("SIGTERM", () => {
    lifecycle.draining = true;
    jsonLog({ msg: "draining", ms: config.drainMs });
    setTimeout(() => server.close(() => process.exit(0)), config.drainMs);
    setTimeout(() => process.exit(0), config.drainMs + 10_000).unref();
  });
}

// Start only with `node src/server.js`, not when a test imports this file.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) start();
