import "server-only";

import { after } from "next/server";

import { dispatchQueuedGrokFromEnv } from "./dispatch-grok";
import { safeLogMessage } from "./secrets";

// After the response is sent. A missing setting is a no-op so the job stays queued.
export function scheduleGrokDispatch() {
  after(() => {
    dispatchQueuedGrokFromEnv()
      .then((result) => {
        if (result.skipped || result.outcomes.length === 0) return;
        console.log(JSON.stringify({ event: "relay.dispatch", outcomes: result.outcomes }));
      })
      .catch((error: unknown) => {
        console.error(
          JSON.stringify({ event: "relay.dispatch_error", message: safeLogMessage(error) }),
        );
      });
  });
}
