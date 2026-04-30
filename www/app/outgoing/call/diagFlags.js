import { requirePlatformAdapter } from "../../runtime/shared/platformAdapter.js";

export function enableInboundAudioStats() {
  try {
    const a = requirePlatformAdapter();
    return !!a?.mediaDiag?.enableInboundAudioStats;
  } catch {
    return false;
  }
}

export function enableAudioOutputRouteDiag() {
  try {
    const a = requirePlatformAdapter();
    return !!a?.mediaDiag?.enableAudioOutputRouteDiag;
  } catch {
    return false;
  }
}

export function enableRenderDiag() {
  try {
    const a = requirePlatformAdapter();
    return !!a?.mediaDiag?.enableRenderDiag;
  } catch {
    return false;
  }
}
