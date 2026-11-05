// Helpers to read a Kubernetes Pod object.

export function isTerminating(pod) {
  return Boolean(pod.metadata.deletionTimestamp);
}

export function isReady(pod) {
  return !isTerminating(pod) &&
    Boolean(pod.status?.conditions?.some((c) => c.type === "Ready" && c.status === "True"));
}

// Same as the RESTARTS column of `kubectl get pods`.
export function restarts(pod) {
  return (pod.status?.containerStatuses ?? []).reduce((sum, c) => sum + (c.restartCount ?? 0), 0);
}

// What the API returns for each pod.
export function toPodView(pod) {
  return { name: pod.metadata.name, ready: isReady(pod), restarts: restarts(pod) };
}

// Sort order: oldest pod first.
export function byAge(a, b) {
  return a.metadata.creationTimestamp.localeCompare(b.metadata.creationTimestamp) ||
    a.metadata.name.localeCompare(b.metadata.name);
}
