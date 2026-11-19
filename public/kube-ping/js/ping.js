// Kube Ping: says hello to the deployment and shows which pod answered.
//
// The card talks to the kube-ping API on the same host:
//   GET /api/ping            -> {"pod", "version", "served", "processingMs"}
//   GET /api/ping/deployment -> {"name", "namespace", "replicas", "readyReplicas",
//                                "pods": [{"name", "ready", "restarts"}], ...}
// "served" is how many requests that pod has answered since it started; each
// replica keeps its own count. Text comes from data attributes so the same
// script serves every language.
(() => {
  "use strict";

  const card = document.getElementById("ping");
  if (!card) return;

  const $ = (id) => document.getElementById(id);
  const text = card.dataset;
  const button = $("ping-send");
  const hops = $("ping-hops");
  const chat = $("ping-chat");
  const replyEl = $("ping-reply");
  const statusEl = $("ping-status");
  const rttEl = $("ping-rtt");
  const appEl = $("ping-app");
  const versionEl = $("ping-version");
  const countEl = $("ping-count");

  // The path animation only explains the route; every number comes from the real request.
  const PATH_MS = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700;
  // HTTP/2 has no status text, so the usual reason phrases are spelled out here.
  const REASONS = {
    200: "OK",
    404: "Not Found",
    429: "Too Many Requests",
    500: "Internal Server Error",
    502: "Bad Gateway",
    503: "Service Unavailable",
    504: "Gateway Timeout",
  };

  let lastPod = null;
  let sent = 0;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const ms = (value) => `${value < 10 ? value.toFixed(2) : Math.round(value)} ms`;

  // ----------------------------------------------------------- One request

  // Round-trip time runs from sending the request to having read the answer.
  async function request() {
    const started = performance.now();
    try {
      const res = await fetch("/api/ping", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      const body = res.ok ? await res.json().catch(() => null) : null;
      return { status: res.status, rtt: performance.now() - started, body };
    } catch (err) {
      return { error: err.name === "TimeoutError" ? text.timeout : text.network };
    }
  }

  async function send() {
    button.disabled = true;
    button.textContent = text.sending;
    sent += 1;
    countEl.textContent = sent;

    // The hello goes out and the reply waits, while the path lights up.
    chat.hidden = false;
    replyEl.className = "bubble bubble-in is-waiting";
    replyEl.replaceChildren(waitingDots());
    hops.classList.remove("is-done", "is-sending");
    void hops.offsetWidth; // restarts the animation, also when sending again right away
    hops.classList.add("is-sending");

    const [result] = await Promise.all([request(), wait(PATH_MS)]);
    hops.classList.remove("is-sending");
    show(result);
    if (inspect.open) loadDeployment();

    button.disabled = false;
    button.textContent = text.send;
  }

  function show({ status, rtt, body, error }) {
    const answered = status !== undefined;
    const ok = status === 200 && typeof body?.pod === "string";
    statusEl.textContent = answered ? `${status} ${REASONS[status] ?? ""}`.trim() : "–";
    statusEl.className = ok ? "is-ok" : answered ? "is-failed" : "";
    rttEl.textContent = answered ? ms(rtt) : "–";

    if (ok) {
      lastPod = body.pod;
      appEl.textContent = ms(body.processingMs);
      versionEl.textContent = body.version;
      replyEl.className = "bubble bubble-in";
      replyEl.replaceChildren(...reply(body));
      hops.classList.add("is-done");
      markServed();
      return;
    }

    // Where it failed isn't known, so no hop is blamed: the path stays unlit.
    appEl.textContent = versionEl.textContent = "–";
    replyEl.className = "bubble bubble-in is-failed";
    const reason = error ?? (status === 200 ? text.unexpected : statusEl.textContent);
    replyEl.textContent = text.failed.replace("{reason}", reason);
  }

  // "Hi! I'm {pod}. That's request #{n} for me." with the pod name in bold.
  // An API without the count gets the short version.
  function reply({ pod, served }) {
    const template = Number.isInteger(served) ? text.reply.replace("{n}", served) : text.replyShort;
    const [before, after] = template.split("{pod}");
    const name = document.createElement("strong");
    name.textContent = pod;
    return [before, name, after];
  }

  function waitingDots() {
    const dots = document.createElement("span");
    dots.className = "typing";
    dots.setAttribute("aria-label", text.waiting);
    dots.append(...[0, 1, 2].map(() => document.createElement("span")));
    return dots;
  }

  // ------------------------------------------------------ Inspect deployment

  // Loaded when the panel opens and after each request, never on a timer.
  const inspect = $("ping-inspect");
  const labels = $("deploy").dataset;
  const podsEl = $("deploy-pods");
  const deployStatus = $("deploy-status");

  async function loadDeployment() {
    try {
      const res = await fetch("/api/ping/deployment", { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`deployment returned ${res.status}`);
      renderDeployment(await res.json());
      deployStatus.textContent = "";
    } catch {
      deployStatus.textContent = labels.offline; // the last good data stays on screen
    }
  }

  function renderDeployment(d) {
    $("deploy-name").textContent = d.name;
    $("deploy-namespace").textContent = d.namespace;
    $("deploy-ready").textContent = `${d.readyReplicas} / ${d.replicas}`;
    podsEl.replaceChildren(...d.pods.map(podRow));
    markServed();
  }

  function podRow(pod) {
    const tr = document.createElement("tr");
    tr.dataset.pod = pod.name;
    for (const value of [pod.name, pod.ready ? labels.yes : labels.no, String(pod.restarts)]) {
      const td = document.createElement("td");
      td.textContent = td.title = value;
      tr.append(td);
    }
    tr.children[1].className = pod.ready ? "is-ready" : "is-failed";
    return tr;
  }

  // The pod that answered the last request, in the text and in the table.
  function markServed() {
    $("deploy-last").textContent = lastPod ?? "–";
    for (const tr of podsEl.children) tr.classList.toggle("is-served", tr.dataset.pod === lastPod);
  }

  button.addEventListener("click", send);
  inspect.addEventListener("toggle", () => inspect.open && loadDeployment());
})();
