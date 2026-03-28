// Dual Session Manager - Manages two simultaneous SIP sessions for Add Call / Conference
// Browser maintains two SIP.js sessions; PBX performs the actual conference bridge

import { setSIPHold } from "./sipHold.js?v=1773023601";
import { nowISO } from "../config.js";
import { logLine } from "../log.js";

export const dualSessionManager = {
  primary: null,      // First SIP session state object
  secondary: null,    // Second SIP session state object
  primaryOnHold: false,
  secondaryOnHold: false,
  
  /**
   * Initialize with the current active session
   */
  setPrimary(st) {
    if (!st?.session) {
      console.warn("[DualSession] No session to set as primary");
      return false;
    }
    
    this.primary = st;
    this.primaryOnHold = false;
    logLine(`[${nowISO()}] [DualSession] Primary session set`);
    return true;
  },
  
  /**
   * Check if we can add a second call
   */
  canAddCall() {
    return this.primary?.session && !this.secondary?.session;
  },
  
  /**
   * Check if we have two active sessions
   */
  hasDualSessions() {
    return !!(this.primary?.session && this.secondary?.session);
  },
  
  /**
   * Get the currently active (not held) session
   */
  getActiveSession() {
    if (this.primary?.session && !this.primaryOnHold) {
      return { st: this.primary, type: 'primary' };
    }
    if (this.secondary?.session && !this.secondaryOnHold) {
      return { st: this.secondary, type: 'secondary' };
    }
    return null;
  },
  
  /**
   * Get the held session
   */
  getHeldSession() {
    if (this.primary?.session && this.primaryOnHold) {
      return { st: this.primary, type: 'primary' };
    }
    if (this.secondary?.session && this.secondaryOnHold) {
      return { st: this.secondary, type: 'secondary' };
    }
    return null;
  },
  
  /**
   * Set the secondary session after Add Call creates it
   */
  setSecondary(st) {
    if (!st?.session) {
      console.warn("[DualSession] No session to set as secondary");
      return false;
    }
    
    this.secondary = st;
    this.secondaryOnHold = false;
    logLine(`[${nowISO()}] [DualSession] Secondary session set`);
    this.emitStateChange();
    return true;
  },
  
  /**
   * Swap: Hold the active call, unhold the held call
   */
  async swap() {
    if (!this.hasDualSessions()) {
      throw new Error("Need two calls to swap");
    }
    
    logLine(`[${nowISO()}] [DualSession] Swap requested`);
    
    // Swap both states
    const p1 = setSIPHold(this.primary, !this.primaryOnHold);
    const p2 = setSIPHold(this.secondary, !this.secondaryOnHold);
    
    await Promise.all([p1, p2]);
    
    // Update internal state tracking
    this.primaryOnHold = !this.primaryOnHold;
    this.secondaryOnHold = !this.secondaryOnHold;
    
    logLine(`[${nowISO()}] [DualSession] Swap completed`);
    this.emitStateChange();
    
    // Emit event to update hold button UI
    window.dispatchEvent(new Event('dual-session:hold-changed'));
    
    return true;
  },
  
  /**
   * Conference using SIP REFER (attended transfer)
   * Transfer primary session to secondary's remote URI
   */
  async conference() {
    if (!this.hasDualSessions()) {
      throw new Error("Need two calls to conference");
    }
    
    logLine(`[${nowISO()}] [DualSession] Conference requested`);
    
    try {
      const held = this.getHeldSession();
      const active = this.getActiveSession();

      const primarySession = held?.st?.session || this.primary.session;
      const secondarySession = active?.st?.session || this.secondary.session;
      
      // Validate sessions are in proper state
      if (!primarySession || !secondarySession) {
        throw new Error("One or both sessions are missing");
      }
      
      // Log session types and states for debugging
      console.log('[DualSession] Primary session:', {
        type: primarySession.constructor?.name,
        state: primarySession.state,
        hasDialog: !!primarySession._dialog,
        remoteIdentity: primarySession.remoteIdentity?.uri?.toString()
      });
      
      console.log('[DualSession] Secondary session:', {
        type: secondarySession.constructor?.name,
        state: secondarySession.state,
        hasDialog: !!secondarySession._dialog,
        remoteIdentity: secondarySession.remoteIdentity?.uri?.toString()
      });
      
      // Access dialog - SIP.js stores it as _dialog (private property)
      const primaryDialog = primarySession._dialog || primarySession.dialog;
      const secondaryDialog = secondarySession._dialog || secondarySession.dialog;
      
      if (!primaryDialog || !secondaryDialog) {
        console.error('[DualSession] Dialog access failed:', {
          primaryDialog: !!primaryDialog,
          secondaryDialog: !!secondaryDialog
        });
        throw new Error("Session dialogs not established");
      }
      
      // Get remote identity/target for REFER
      const secondaryRemoteUri = secondarySession.remoteIdentity?.uri;
      if (!secondaryRemoteUri) {
        throw new Error("Cannot get remote URI from secondary session");
      }
      
      // Build Replaces header parameter from secondary dialog
      // Format: Call-ID;to-tag=remote-tag;from-tag=local-tag
      const secondaryCallId = secondaryDialog.callId;
      const secondaryLocalTag = secondaryDialog.localTag;
      const secondaryRemoteTag = secondaryDialog.remoteTag;
      
      if (!secondaryCallId || !secondaryLocalTag || !secondaryRemoteTag) {
        console.error('[DualSession] Missing dialog tags:', {
          callId: secondaryCallId,
          localTag: secondaryLocalTag,
          remoteTag: secondaryRemoteTag
        });
        throw new Error("Cannot build Replaces header - missing dialog tags");
      }
      
      // RFC 3891: Replaces header format with to-tag and from-tag
      const replacesValue = `${secondaryCallId};to-tag=${secondaryRemoteTag};from-tag=${secondaryLocalTag}`;

      // Build Refer-To URI with Replaces as SIP URI *header* (after '?')
      // Do not inject a raw Refer-To header via extraHeaders; SIP.js will create one.
      const referToUri = secondaryRemoteUri.clone ? secondaryRemoteUri.clone() : secondaryRemoteUri;
      try {
        if (!referToUri.headers) referToUri.headers = {};
        referToUri.headers.Replaces = [encodeURIComponent(replacesValue)];
      } catch {}

      const referToUriStr = referToUri.toString ? referToUri.toString() : String(referToUri);
      logLine(`[${nowISO()}] [DualSession] Conferencing: REFER to ${referToUriStr}`);
      console.log('[DualSession] Replaces value:', replacesValue);

      // Use held session to REFER remote party to the active call (attended transfer/merge)
      try {
        await primarySession.refer(referToUri, {
          requestDelegate: {
            onAccept: (response) => {
              logLine(`[${nowISO()}] [DualSession] REFER accepted: ${response?.message?.statusCode || 'OK'}`);
            },
            onReject: (response) => {
              logLine(`[${nowISO()}] [DualSession] REFER rejected: ${response?.message?.statusCode || 'error'}`);
            }
          }
        });
        
        logLine(`[${nowISO()}] [DualSession] Conference REFER sent successfully`);
        this.emitStateChange();
        return true;
        
      } catch (referErr) {
        console.error('[DualSession] REFER failed:', referErr);
        throw new Error(`REFER failed: ${referErr?.message || referErr}`);
      }
      
    } catch (err) {
      console.error("[DualSession] Conference failed:", err);
      logLine(`[${nowISO()}] [DualSession] Conference error: ${err?.message || err}`);
      throw err;
    }
  },
  
  /**
   * Clean up when a session ends
   */
  removeSession(st) {
    if (this.primary === st) {
      logLine(`[${nowISO()}] [DualSession] Primary session removed`);
      this.primary = null;
      this.primaryOnHold = false;
      
      // Promote secondary to primary if it exists
      if (this.secondary?.session) {
        logLine(`[${nowISO()}] [DualSession] Promoting secondary to primary`);
        this.primary = this.secondary;
        this.primaryOnHold = this.secondaryOnHold;
        this.secondary = null;
        this.secondaryOnHold = false;
      }
    } else if (this.secondary === st) {
      logLine(`[${nowISO()}] [DualSession] Secondary session removed`);
      this.secondary = null;
      this.secondaryOnHold = false;
    }
    
    this.emitStateChange();
  },
  
  /**
   * Reset all sessions
   */
  reset() {
    this.primary = null;
    this.secondary = null;
    this.primaryOnHold = false;
    this.secondaryOnHold = false;
    this.emitStateChange();
  },
  
  /**
   * Emit custom event for UI updates
   */
  emitStateChange() {
    const detail = {
      hasPrimary: !!this.primary?.session,
      hasSecondary: !!this.secondary?.session,
      hasDual: this.hasDualSessions(),
      canSwap: this.hasDualSessions(),
      canConference: this.hasDualSessions(),
      primaryOnHold: this.primaryOnHold,
      secondaryOnHold: this.secondaryOnHold,
    };
    
    window.dispatchEvent(new CustomEvent('dual-session:state-changed', { detail }));
  }
};

// Global access for debugging
window.dualSessionManager = dualSessionManager;
