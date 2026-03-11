// Add Call - Create a second SIP session for dual-call management
// This module handles creating a second outbound call while maintaining the first

import { nowISO } from "../config.js";
import { formatSipResponse, getSipRejectDetails, mapSipFailureToMessage, logLine } from "../log.js";
import { g711OnlyModifier } from "../sdp.js";
import { bindPeerConnection } from "../pcDebug.js";
import { ensureMicAccess, getLocalStream } from "../media.js";
import { attachRemoteAudio } from "../outgoing/media.js?v=1773032001";
import { dualSessionManager } from "../features/dualSessionManager.js";
import { setSIPHold, syncHoldButtonUI } from "../features/sipHold.js?v=1773023601";

function configureRemoteAudio() {
  const audioEl = document.getElementById("remoteAudio");
  if (!audioEl) return;
  audioEl.autoplay = true;
  audioEl.playsInline = true;
  audioEl.muted = false;
  audioEl.volume = 0.7;
  const prePlayPromise = audioEl.play?.();
  if (prePlayPromise && typeof prePlayPromise.catch === "function") {
    prePlayPromise.catch(() => {});
  }
}

function onSecondaryStateChange(SIP, inviter, st, ui) {
  return (s) => {
    logLine(`[${nowISO()}] [session:secondary] ${s}`);
    bindPeerConnection(inviter, "secondary");
    attachRemoteAudio(inviter, ui);

    if (s === SIP.SessionState.Established) {
      ui.setStatus("Second call established");
      // Emit event for UI updates
      dualSessionManager.emitStateChange();
      return;
    }

    if (s === SIP.SessionState.Terminated) {
      // Remove from dual session manager
      dualSessionManager.removeSession(st);
      ui.setStatus(dualSessionManager.primary?.session ? "Call active" : "Idle");
    }
  };
}

/**
 * Add a second call - creates new SIP session for secondary call
 */
export async function addSecondCall(SIP, primarySt, ui, number) {
  if (!primarySt?.registered || !primarySt?.ua) {
    return { success: false, error: "Not registered" };
  }
  
  if (!number) {
    return { success: false, error: "Missing destination" };
  }
  
  if (!dualSessionManager.canAddCall()) {
    return { success: false, error: "Already have second call or no primary call" };
  }
  
  logLine(`[${nowISO()}] [AddCall] Starting add call flow for: ${number}`);
  
  try {
    // Step 1: Hold the primary call
    logLine(`[${nowISO()}] [AddCall] Holding primary call...`);
    const held = await setSIPHold(primarySt, true);
    if (!held) {
      return { success: false, error: "Failed to hold primary call" };
    }
    
    dualSessionManager.primaryOnHold = true;
    ui.setStatus("Primary call on hold, dialing...");
    
    // Update hold button UI to show "Unhold"
    syncHoldButtonUI();
    
    // Step 2: Ensure mic access (should already be granted)
    const micOk = await ensureMicAccess(ui.setStatus);
    if (!micOk) {
      return { success: false, error: "Microphone access denied" };
    }
    
    // Step 3: Create secondary state object (separate from primary)
    const secondarySt = {
      ua: primarySt.ua,
      registered: primarySt.registered,
      account: primarySt.account,
      session: null,
    };
    
    // Step 4: Build target URI
    const resolvedAccount = ui.account ? ui.account() : null;
    const domain = primarySt.account?.domain || resolvedAccount?.domain || ui.domain() || ui.domainFallback?.();
    if (!domain) {
      return { success: false, error: "Missing domain" };
    }
    
    const encodedTarget = encodeURIComponent(number);
    const targetUri = SIP.UserAgent.makeURI(`sip:${encodedTarget}@${domain}`);
    if (!targetUri) {
      return { success: false, error: "Invalid destination" };
    }
    
    logLine(`[${nowISO()}] [AddCall] Creating secondary session to ${number}`);
    configureRemoteAudio();
    
    // Step 5: Create second SIP Inviter
    const inviter = new SIP.Inviter(primarySt.ua, targetUri, {
      earlyMedia: true,
      extraHeaders: ["P-Early-Media: supported"],
      sessionDescriptionHandlerModifiers: [g711OnlyModifier],
      sessionDescriptionHandlerOptions: {
        constraints: { audio: true, video: false },
        localMediaStream: getLocalStream() || undefined,
      },
    });
    
    const requestDelegate = {
      onTrying: async (resp) => {
        const info = formatSipResponse(resp);
        if (info) logLine(`[${nowISO()}] [AddCall] trying ${info}`);
      },
      onProgress: async (resp) => {
        const info = formatSipResponse(resp);
        if (info) logLine(`[${nowISO()}] [AddCall] progress ${info}`);
        
        const code = resp?.message?.statusCode || resp?.statusCode || resp?.message?.status;
        if (code === 180 || code === 183) {
          ui.setStatus(code === 180 ? "Second call ringing..." : "Second call progress...");
          attachRemoteAudio(inviter, ui);
        }
      },
      onAccept: async (resp) => {
        const info = formatSipResponse(resp);
        ui.setStatus(info ? `Second call established (${info})` : "Second call established");
        logLine(`[${nowISO()}] [AddCall] Second call answered`);
      },
      onRedirect: async (resp) => {
        const info = formatSipResponse(resp);
        ui.setStatus(info ? `Second call redirected (${info})` : "Second call redirected");
      },
      onReject: async (resp) => {
        const info = formatSipResponse(resp);
        const details = getSipRejectDetails(resp);
        const human = mapSipFailureToMessage(details);
        const q850 = details.q850Cause ? `; Q.850 cause=${details.q850Cause}${details.q850Text ? ` (${details.q850Text})` : ""}` : "";
        ui.setStatus(info ? `Second call: ${human} (${info})` : `Second call: ${human}`);
        logLine(`[${nowISO()}] [AddCall] Second call rejected ${info || "unknown"}${q850}`);
        secondarySt.session = null;
        
        // Resume primary call
        await setSIPHold(primarySt, false);
        dualSessionManager.primaryOnHold = false;
        syncHoldButtonUI();
        ui.setStatus("Primary call resumed");
      },
    };
    
    secondarySt.session = inviter;
    bindPeerConnection(inviter, "secondary");
    inviter.stateChange.addListener(onSecondaryStateChange(SIP, inviter, secondarySt, ui));
    
    // Step 6: Send INVITE for second call
    await inviter.invite(requestDelegate);
    
    // Step 7: Register with dual session manager
    dualSessionManager.setSecondary(secondarySt);
    
    logLine(`[${nowISO()}] [AddCall] Secondary call INVITE sent successfully`);
    return { success: true, secondarySt };
    
  } catch (err) {
    console.error("[AddCall] Failed:", err);
    logLine(`[${nowISO()}] [AddCall] Error: ${err?.message || err}`);
    
    // Try to resume primary call on error
    try {
      await setSIPHold(primarySt, false);
      dualSessionManager.primaryOnHold = false;
      syncHoldButtonUI();
      ui.setStatus("Primary call resumed after add call failure");
    } catch {}
    
    return { success: false, error: err?.message || "Add call failed" };
  }
}
