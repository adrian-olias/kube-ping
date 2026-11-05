// GET /api/ping → which pod answered, its version, how many requests it has
// served, and how long the app took.
//
// served counts the requests this pod answered since it started. It lives in
// the pod's memory, so each replica has its own count and a restart resets it:
// the card uses it to show that requests are spread across separate pods.
//
// processingMs runs from the moment the request reached the app to just before
// the answer is written: the app's share of the round trip, nothing else.
// It is also sent as Server-Timing, so browser dev tools show it.
export function createPingController({ podName, version, clock = () => performance.now() }) {
  let served = 0;

  return {
    ping: async ({ receivedAt }) => {
      served += 1;
      const processingMs = Math.round((clock() - receivedAt) * 100) / 100;
      return {
        status: 200,
        body: { pod: podName, version, served, processingMs },
        headers: { "Server-Timing": `app;dur=${processingMs}` },
      };
    },
  };
}
