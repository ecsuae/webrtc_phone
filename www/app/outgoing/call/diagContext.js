import { isMobileCompatModeEnabled } from "../../features/mobileNetworkMode.js";

export function getOutboundDiagContext(st, target, inviter) {
  const username = st.account?.rawUsername || st.account?.username || undefined;
  const domain = st.account?.domain || undefined;
  const aor = (username && domain) ? `${username}@${domain}` : undefined;
  const callId = inviter?.outgoingRequestMessage?.callId || undefined;
  const sessionId = inviter?.id || inviter?._id || undefined;
  const corrId = inviter?.__webrtcCorrId || inviter?.__callMediaDiag?.corrId || st?.__webrtcCorrId || undefined;
  const selectedProfile = st.selectedProfile || (isMobileCompatModeEnabled() ? 'lte' : 'wifi');
  const lteMode = selectedProfile === 'lte';
  const mode = lteMode ? 'lte' : 'wifi';
  const icePolicy = lteMode ? 'relay' : 'all';
  const localMicTrackId = inviter?.__desktopMicTrackId || st?.__desktopMicTrackId || undefined;
  return {
    username,
    domain,
    aor,
    dir: 'outbound',
    peer: target || undefined,
    callId,
    corrId,
    sessionId,
    lteMode,
    mode,
    selectedProfile,
    icePolicy,
    localMicTrackId,
    probeBuildId: (() => {
      try {
        return window?.OUTBOUND_CALLER_PROBE_BUILD_ID || localStorage.getItem('OUTBOUND_CALLER_PROBE_BUILD_ID') || undefined;
      } catch {
        return undefined;
      }
    })(),
  };
}
