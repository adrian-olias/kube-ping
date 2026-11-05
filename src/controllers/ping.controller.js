// GET /api/ping → which pod answered, its version, and how long the app took.
//
// processingMs runs from the moment the request reached the app to just before
// the answer is written: the app's share of the round trip, nothing else.
// It is also sent as Server-Timing, so browser dev tools show it.
export function createPingController({ podName, version, clock = () => performance.now() }) {
  return {
    ping: async ({ receivedAt }) => {
      const processingMs = Math.round((clock() - receivedAt) * 100) / 100;
      return {
        status: 200,
        body: { pod: podName, version, processingMs },
        headers: { "Server-Timing": `app;dur=${processingMs}` },
      };
    },
  };
}
