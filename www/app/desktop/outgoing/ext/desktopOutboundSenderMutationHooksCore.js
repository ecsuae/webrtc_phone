import { installDesktopOutboundSenderMutationHooksPcWrap } from "./desktopOutboundSenderMutationHooksPcWrap.js";
import { installDesktopOutboundSenderMutationHooksSenderWrap } from "./desktopOutboundSenderMutationHooksSenderWrap.js";
import { installDesktopOutboundSenderMutationHooksDescriptionWrap } from "./desktopOutboundSenderMutationHooksDescriptionWrap.js";

export function installDesktopOutboundSenderMutationHooks(inviter, st, peer, pc) {
  try {
    if (!pc || pc.__desktopSenderMutationHooksInstalled) return;
    pc.__desktopSenderMutationHooksInstalled = true;
  } catch {
    return;
  }

  try {
    installDesktopOutboundSenderMutationHooksPcWrap(inviter, st, peer, pc);
  } catch {}

  try {
    const origAddTransceiver = pc.addTransceiver?.bind(pc);
    if (typeof origAddTransceiver === "function") {
      pc.addTransceiver = (...args) => {
        const r = origAddTransceiver(...args);
        try {
          installDesktopOutboundSenderMutationHooksSenderWrap(inviter, st, peer, pc, r);
        } catch {}
        return r;
      };
    }
  } catch {}

  try {
    installDesktopOutboundSenderMutationHooksDescriptionWrap(inviter, st, peer, pc);
  } catch {}
}
