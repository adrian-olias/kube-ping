# kube-ping

The Kube Ping page and the API behind its card. The card sends a request through
the deployment and shows which pod answered, the round-trip time, the time the app
spent on it, and how the Deployment is set up.

Plain Node.js with no dependencies, running on a distroless image. One container
serves everything:

- **Page** at `/kube-ping/` (English) and `/es/kube-ping/` (Spanish). Files are in
  `public/`, under the same paths, and are copied into the image.
- **API** at `/api/ping...` (see below).

The ingress in `helm-charts-wrappers` sends `/kube-ping`, `/es/kube-ping` and `/api/ping`
to this app. The rest of the site is the [portfolio](https://github.com/adrian-olias/portfolio).

`public/kube-ping/css/` and `public/kube-ping/js/` hold copies of `base.css`,
`panel.css` and `theme.js`: the page doesn't depend on another repository.

## Endpoints

| Route | What it does |
|---|---|
| `GET /api/ping` | The pod that answered, the app version, `served` and `processingMs`, also sent as `Server-Timing` |
| `GET /api/ping/deployment` | The live Deployment: ready replicas, pods, resources and probe paths |

`served` counts the requests that pod answered since it started. It lives in
the pod's memory on purpose: each replica has its own count and a restart
resets it, so pressing the button a few times shows the requests landing on
different pods. There is nothing to persist or share between replicas.
| `GET /healthz` | Liveness: the process is up |
| `GET /readyz` | Readiness: 503 while the pod shuts down |

## What the timings mean

- **Round-trip time** is measured in the browser, from sending the request to
  reading the answer. It includes the network, Traefik and the app.
- **App processing** runs from the moment the request reaches the app to just
  before the answer is written. It is the app's share of the round trip.

The card draws Browser → Ingress → Service → Pod as the logical path. The
Service is not a separate hop with its own timing: Traefik reads its endpoints
and sends the request straight to a pod. Timing each component would need
distributed tracing, which this first version doesn't have.

## Deployment info

`/api/ping/deployment` reads the Deployment and its pods from the Kubernetes
API, with a read-only Role in the app's own namespace. What isn't set is `null`
(for example, there is no CPU limit on purpose), so the card never shows a
default as if it were configured. Answers are cached for 2 seconds.

## Shutdown

On SIGTERM, `/readyz` turns 503 and the app keeps answering for 5 seconds
(`DRAIN_MS`) while Kubernetes takes the pod out of the Service, then it closes.
With two replicas, a rollout or a deleted pod doesn't drop requests.

## Run locally

```bash
kubectl proxy &
DEPLOYMENT_NAME=kube-ping POD_SELECTOR=app.kubernetes.io/name=kube-ping \
NAMESPACE=kube-ping-prod KUBE_API_URL=http://127.0.0.1:8001 npm start
```

## Test

```bash
npm test
```

## Release

Push a tag like `v0.1.0`. CI runs the tests and publishes
`ghcr.io/adrian-olias/kube-ping:0.1.0`, with `0.1.0` as the version the card shows.
