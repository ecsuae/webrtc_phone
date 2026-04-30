import { sendCallMediaEvent } from "../../../features/callMediaLog.js";
import { runMediaStatsTick } from "./tick.js";
import {
  bindOutboundReceiveLegObservers,
} from "./helpers.js";

export function scheduleMediaStatsSnapshots(pc, label, diagCtx = {}) {
  if (!pc || pc.__mediaStatsScheduled) return;
  pc.__mediaStatsScheduled = true;

  const base = { ...diagCtx, dir: diagCtx.dir || label };

  bindOutboundReceiveLegObservers(pc, base);

  if (base.dir === "outbound") {
    try {
      sendCallMediaEvent({ type: "outbound-stats-scheduled", ...base, msg: "Outbound stats snapshots scheduled" });
    } catch {}

    try {
      if (!pc.__missingOutboundStatsTimer) {
        pc.__missingOutboundStatsTimer = setTimeout(() => {
          try {
            if (pc.__outboundStats2sEmitted) return;
            sendCallMediaEvent({
              type: "missing-outbound-stats",
              ...base,
              msg: "Outbound call established but outbound-stats-2s did not fire (hook failure or no pc/stats)",
            });
          } catch {}
        }, 4000);
      }
    } catch {}
  }

  const schedule = (ms, type) => {
    setTimeout(async () => {
      await runMediaStatsTick({ pc, label, base, type });
    }, ms);
  };

  schedule(2000, "media-stats-2s");
  schedule(5000, "media-stats-5s");
  schedule(10000, "media-stats-10s");
}
