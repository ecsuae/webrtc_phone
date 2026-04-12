import { defaultsFromBody, el, parseSipAccount, setText } from "../dom.js";
import { updateUsernameDisplay, updateDomainDisplay } from "../features/accountDisplay.js";
import { isMobileCompatModeEnabled } from "../features/mobileNetworkMode.js";
import { sendCallMediaEvent } from "../features/callMediaLog.js";

let callNavigationLockActive = false;
let callNavigationGuardInstalled = false;

let _rtpUiTimer = null;
let _rtpUiLast = null;

let _rtpUiAudio = null;

function _safeCallDiagContext(st) {
  try {
    const s = st?.session || null;
    return {
      corrId: s?.__webrtcCorrId || st?.__webrtcCorrId || undefined,
      callId: s?.outgoingRequestMessage?.callId || s?.incomingRequestMessage?.callId || undefined,
    };
  } catch {
    return {};
  }
}

function _safeTrackIds(streamOrTracks) {
  try {
    const tracks = Array.isArray(streamOrTracks)
      ? streamOrTracks
      : (streamOrTracks?.getTracks?.() || []);
    return tracks.map((t) => t?.id || null).filter(Boolean).slice(0, 8);
  } catch {
    return undefined;
  }
}

function _safeCloseAudioMeter() {
  try {
    if (_rtpUiAudio?.ctx && typeof _rtpUiAudio.ctx.close === 'function') {
      try {
        sendCallMediaEvent({
          type: 'audio-context-closed',
          ..._safeCallDiagContext(null),
          sourceTag: 'rtp-ui-meter',
          contextState: _rtpUiAudio?.ctx?.state,
          msg: 'UI meter AudioContext close requested',
        });
      } catch {}
      _rtpUiAudio.ctx.close().catch(() => {});
    }
  } catch {}
  _rtpUiAudio = null;
}

function _readMeterLevel01(analyser, buf) {
  try {
    if (!analyser || !buf) return null;
    analyser.getByteTimeDomainData(buf);
    let sumSq = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = (buf[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    if (!Number.isFinite(rms)) return null;
    return Math.max(0, Math.min(1, rms));
  } catch {
    return null;
  }
}

function _ensureAudioMetersBound(st) {
  try {
    if (!_rtpUiAudio) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      _rtpUiAudio = {
        ctx,
        tx: { analyser: null, buf: null, src: null, trackId: null },
        rx: { analyser: null, buf: null, src: null },
      };

      try {
        sendCallMediaEvent({
          type: 'audio-context-created',
          ..._safeCallDiagContext(st),
          sourceTag: 'rtp-ui-meter',
          contextState: ctx?.state,
          msg: 'UI meter AudioContext created',
        });
      } catch {}

      try {
        if (!_rtpUiAudio.ctx.__diagStateListenerBound) {
          _rtpUiAudio.ctx.__diagStateListenerBound = true;
          _rtpUiAudio.ctx.onstatechange = () => {
            try {
              sendCallMediaEvent({
                type: 'audio-context-state',
                ..._safeCallDiagContext(st),
                sourceTag: 'rtp-ui-meter',
                contextState: _rtpUiAudio?.ctx?.state,
                msg: 'UI meter AudioContext state change',
              });
            } catch {}
          };
        }
      } catch {}
    }

    try {
      if (_rtpUiAudio.ctx?.state === 'suspended') {
        _rtpUiAudio.ctx.resume().catch(() => {});
      }
    } catch {}

    // TX meter from local sender audio track
    try {
      const pc = st?.session?.sessionDescriptionHandler?.peerConnection;
      const track = pc?.getSenders?.().find((s) => s.track?.kind === 'audio')?.track || null;
      const trackId = track?.id || null;
      const needsRebind = !!trackId && _rtpUiAudio.tx.trackId !== trackId;
      if (needsRebind) {
        try {
          _rtpUiAudio.tx.src?.disconnect?.();
          sendCallMediaEvent({
            type: 'media-stream-source-disconnected',
            ..._safeCallDiagContext(st),
            sourceTag: 'rtp-ui-meter:tx',
            contextState: _rtpUiAudio?.ctx?.state,
            trackIds: _safeTrackIds([track].filter(Boolean)),
            msg: 'UI meter TX MediaStreamSource disconnected (rebind)',
          });
        } catch {}
        _rtpUiAudio.tx = { analyser: null, buf: null, src: null, trackId };
      }

      if (track && !_rtpUiAudio.tx.analyser) {
        const stream = new MediaStream([track]);
        const src = _rtpUiAudio.ctx.createMediaStreamSource(stream);
        const analyser = _rtpUiAudio.ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        _rtpUiAudio.tx.src = src;
        _rtpUiAudio.tx.analyser = analyser;
        _rtpUiAudio.tx.buf = new Uint8Array(analyser.fftSize);

        try {
          sendCallMediaEvent({
            type: 'media-stream-source-created',
            ..._safeCallDiagContext(st),
            sourceTag: 'rtp-ui-meter:tx',
            contextState: _rtpUiAudio?.ctx?.state,
            streamId: stream?.id,
            trackIds: _safeTrackIds(stream),
            msg: 'UI meter TX MediaStreamSource created',
          });
        } catch {}
      }
    } catch {}

    // RX meter from remote audio element captureStream (does not affect playback)
    try {
      const audioEl = document.getElementById('remoteAudio');
      const canCapture = typeof audioEl?.captureStream === 'function';
      if (audioEl && canCapture && !_rtpUiAudio.rx.analyser) {
        const stream = audioEl.captureStream();
        const src = _rtpUiAudio.ctx.createMediaStreamSource(stream);
        const analyser = _rtpUiAudio.ctx.createAnalyser();
        analyser.fftSize = 1024;
        src.connect(analyser);
        _rtpUiAudio.rx.src = src;
        _rtpUiAudio.rx.analyser = analyser;
        _rtpUiAudio.rx.buf = new Uint8Array(analyser.fftSize);

        try {
          sendCallMediaEvent({
            type: 'media-stream-source-created',
            ..._safeCallDiagContext(st),
            sourceTag: 'rtp-ui-meter:rx',
            contextState: _rtpUiAudio?.ctx?.state,
            streamId: stream?.id,
            trackIds: _safeTrackIds(stream),
            msg: 'UI meter RX MediaStreamSource created (from remoteAudio.captureStream)',
          });
        } catch {}
      }
    } catch {}
  } catch {
    // ignore
  }
}

async function _readAudioPacketTotals(pc) {
  const out = { inPackets: 0, outPackets: 0, inAudioEnergy: null, outAudioEnergy: null };
  try {
    if (!pc || typeof pc.getStats !== 'function') return out;
    const stats = await pc.getStats();
    stats.forEach((r) => {
      const isAudio = (r.kind === 'audio' || r.mediaType === 'audio');
      if (r.type === 'inbound-rtp' && isAudio) {
        out.inPackets += Number(r.packetsReceived || 0);
        if (typeof r.totalAudioEnergy === 'number') out.inAudioEnergy = (out.inAudioEnergy || 0) + r.totalAudioEnergy;
      }
      if (r.type === 'outbound-rtp' && isAudio) {
        out.outPackets += Number(r.packetsSent || 0);
        if (typeof r.totalAudioEnergy === 'number') out.outAudioEnergy = (out.outAudioEnergy || 0) + r.totalAudioEnergy;
      }
    });
  } catch {
    return out;
  }
  return out;
}

function _stopRtpIndicatorsUi() {
  if (_rtpUiTimer) {
    clearInterval(_rtpUiTimer);
    _rtpUiTimer = null;
  }
  _rtpUiLast = null;
  _safeCloseAudioMeter();
  try {
    document.getElementById('rtpIndicators')?.style?.setProperty('display', 'none');
  } catch {}
}

function _ensureRtpIndicatorsUiBound(st) {
  try {
    const inCall = !!st?.session;
    if (!inCall) {
      _stopRtpIndicatorsUi();
      return;
    }

    const root = document.getElementById('rtpIndicators');
    const rxBar = document.getElementById('rtpRxBar');
    const txBar = document.getElementById('rtpTxBar');
    const rxText = document.getElementById('rtpRxText');
    const txText = document.getElementById('rtpTxText');

    if (!root || !rxBar || !txBar || !rxText || !txText) {
      _stopRtpIndicatorsUi();
      return;
    }

    try { root.style.setProperty('display', 'grid'); } catch {}

    if (_rtpUiTimer) return;

    _rtpUiTimer = setInterval(async () => {
      try {
        if (!st?.session) {
          _stopRtpIndicatorsUi();
          return;
        }
        const pcNow = st.session?.sessionDescriptionHandler?.peerConnection;
        if (!pcNow) return;

        _ensureAudioMetersBound(st);

        const now = Date.now();
        const totals = await _readAudioPacketTotals(pcNow);

        if (!_rtpUiLast) {
          _rtpUiLast = { ts: now, ...totals };
          return;
        }

        const dt = Math.max(0.5, (now - _rtpUiLast.ts) / 1000);
        let rxPps = Math.max(0, (totals.inPackets - _rtpUiLast.inPackets) / dt);
        let txPps = Math.max(0, (totals.outPackets - _rtpUiLast.outPackets) / dt);

        const rxEnergyOk = typeof totals.inAudioEnergy === 'number' && typeof _rtpUiLast.inAudioEnergy === 'number';
        const txEnergyOk = typeof totals.outAudioEnergy === 'number' && typeof _rtpUiLast.outAudioEnergy === 'number';
        const silenceThreshold = 1e-6;

        if (rxEnergyOk) {
          const rxEnergyRate = Math.max(0, (totals.inAudioEnergy - _rtpUiLast.inAudioEnergy) / dt);
          if (rxEnergyRate <= silenceThreshold) rxPps = 0;
        }
        if (txEnergyOk) {
          const txEnergyRate = Math.max(0, (totals.outAudioEnergy - _rtpUiLast.outAudioEnergy) / dt);
          if (txEnergyRate <= silenceThreshold) txPps = 0;
        }
        _rtpUiLast = { ts: now, ...totals };

        const rxLevel = _readMeterLevel01(_rtpUiAudio?.rx?.analyser, _rtpUiAudio?.rx?.buf);
        const txLevel = _readMeterLevel01(_rtpUiAudio?.tx?.analyser, _rtpUiAudio?.tx?.buf);

        const rxPct = typeof rxLevel === 'number'
          ? Math.max(0, Math.min(100, rxLevel * 220))
          : Math.max(0, Math.min(100, (rxPps / 250) * 100));
        const txPct = typeof txLevel === 'number'
          ? Math.max(0, Math.min(100, txLevel * 220))
          : Math.max(0, Math.min(100, (txPps / 250) * 100));

        rxBar.style.width = `${rxPct.toFixed(1)}%`;
        txBar.style.width = `${txPct.toFixed(1)}%`;

        rxText.textContent = `${Math.round(rxPct)}%`;
        txText.textContent = `${Math.round(txPct)}%`;
        try {
          rxText.title = `${Math.round(rxPps)} pkt/s`;
          txText.title = `${Math.round(txPps)} pkt/s`;
        } catch {}
      } catch {
        // ignore
      }
    }, 1000);
  } catch {
    _stopRtpIndicatorsUi();
  }
}

function installCallNavigationGuard() {
  if (callNavigationGuardInstalled || typeof window === "undefined") return;

  const forceDialTab = () => {
    const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
    if (dialBtn instanceof HTMLElement) dialBtn.click();
  };

  window.addEventListener("popstate", () => {
    if (!callNavigationLockActive) return;
    try {
      window.history.pushState({ dialerCallLock: true }, "", window.location.href);
    } catch {
      // Ignore browser history guard errors.
    }
    forceDialTab();
  });

  // Stop accidental taps/swipes from switching tabs during a call.
  // Capture phase so it wins against other handlers.
  const interactionGuard = (e) => {
    if (!callNavigationLockActive) return;
    const target = e.target;
    if (!(target instanceof Element)) return;

    const tabBtn = target.closest?.('.tab-btn[data-tab]');
    const tab = tabBtn?.getAttribute?.('data-tab');
    if (tab && tab !== 'dial-tab') {
      e.preventDefault?.();
      e.stopPropagation?.();
      forceDialTab();
    }
  };
  document.addEventListener("touchstart", interactionGuard, { capture: true, passive: false });
  document.addEventListener("click", interactionGuard, { capture: true });

  // Best-effort protection against leaving the page while a call is active.
  window.addEventListener("beforeunload", (e) => {
    if (!callNavigationLockActive) return;
    e.preventDefault();
    e.returnValue = "";
  });

  callNavigationGuardInstalled = true;
}

function setCallNavigationLock(enabled) {
  installCallNavigationGuard();
  if (!enabled) {
    callNavigationLockActive = false;
    return;
  }

  if (!callNavigationLockActive) {
    try {
      window.history.pushState({ dialerCallLock: true }, "", window.location.href);
    } catch {
      // Ignore browser history guard errors.
    }
  }
  callNavigationLockActive = true;
}

function updateControlVisibility(st, ui) {
  const registered = st.registered;
  const hasIncoming = !!st.incomingInvitation;
  const inCall = !!st.session;
  const showDialpad = registered || inCall || hasIncoming;

  const prevInCall = !!updateControlVisibility.__prevInCall;
  updateControlVisibility.__prevInCall = inCall;
  if (prevInCall && !inCall) {
    try {
      if (el.dial) el.dial.value = '';
    } catch {}
  }

  const selectedProfile = st.selectedProfile;
  const profileBadge = document.getElementById('activeProfileBadge');
  if (profileBadge) {
    const beforeLogin = !registered;
    const resolved = (selectedProfile === 'lte' || selectedProfile === 'wifi')
      ? selectedProfile
      : (beforeLogin && isMobileCompatModeEnabled() ? 'lte' : 'wifi');
    const renderedIcon = resolved === 'lte' ? '5g' : 'wifi';
    const renderedIconClass = resolved === 'lte' ? 'fa-solid fa-signal' : 'fa-solid fa-wifi';
    const renderedLabel = resolved === 'lte' ? 'LTE' : 'Wi-Fi';
    profileBadge.innerHTML = `<i class="${renderedIconClass}"></i>`;
    profileBadge.classList.toggle('profile-lte', resolved === 'lte');
    profileBadge.classList.toggle('profile-wifi', resolved !== 'lte');
    profileBadge.setAttribute('title', resolved === 'lte' ? 'LTE/5G compatibility profile selected' : 'Normal (Wi-Fi) profile selected');

    try {
      sendCallMediaEvent({
        type: 'profile-badge-rendered',
        selectedProfile: resolved,
        renderedIcon,
        renderedIconClass,
        renderedLabel,
        beforeLogin,
        msg: 'Profile badge rendered',
      });
    } catch {
      // no-op
    }
  }

  const setButtonLabel = (button, iconClass, text) => {
    if (!button) return;
    const icon = button.querySelector("i");
    const span = button.querySelector("span");
    if (icon && iconClass) icon.className = iconClass;
    if (span) span.textContent = text;
  };

  const activateDialTab = () => {
    const dialBtn = document.querySelector('.tab-btn[data-tab="dial-tab"]');
    const allBtns = document.querySelectorAll(".tab-btn[data-tab]");
    const allTabs = document.querySelectorAll(".tab-content");
    allBtns.forEach((btn) => btn.classList.remove("active"));
    allTabs.forEach((tab) => tab.classList.remove("active"));
    dialBtn?.classList.add("active");
    document.getElementById("dial-tab")?.classList.add("active");
  };

  document.getElementById("registrationCard")?.style.setProperty("display", registered ? "none" : "");
  document.getElementById("dialpadCard")?.style.setProperty("display", showDialpad ? "" : "none");
  document.getElementById("refreshBtn")?.style.setProperty("display", "");
  document.getElementById("logOffBtn")?.style.setProperty("display", registered ? "" : "none");
  document.getElementById("accountFields")?.style.setProperty("display", registered ? "none" : "grid");

  if (el.btnStart) el.btnStart.style.display = registered ? "none" : "";
  if (el.btnStop) el.btnStop.style.display = registered ? "" : "";

  if (el.btnCall) {
    el.btnCall.disabled = !registered || inCall;
    el.btnCall.style.display = "";
    if (hasIncoming) {
      setButtonLabel(el.btnCall, "fas fa-phone", "Accept");
    } else {
      setButtonLabel(el.btnCall, "fas fa-phone", "Call");
    }
  }
  if (el.btnHangup) {
    el.btnHangup.disabled = !(inCall || hasIncoming);
    el.btnHangup.style.display = inCall || hasIncoming ? "" : "none";
    if (hasIncoming) {
      setButtonLabel(el.btnHangup, "fas fa-phone-slash", "Reject");
    } else {
      setButtonLabel(el.btnHangup, "fas fa-phone-slash", "End");
    }
  }
  if (el.btnAnswer) {
    el.btnAnswer.disabled = !hasIncoming;
    el.btnAnswer.style.display = "none";
  }
  if (el.btnReject) {
    el.btnReject.disabled = !hasIncoming;
    el.btnReject.style.display = "none";
  }

  document.querySelector(".dial-display")?.style.setProperty("display", inCall ? "none" : "");
  document.querySelector(".dial-buttons")?.style.setProperty("display", inCall ? "none" : "");
  document.getElementById("callControls")?.style.setProperty("display", inCall ? "grid" : "none");

  try {
    const card = document.getElementById('dialpadCard');
    card?.classList?.toggle('in-call', inCall);
  } catch {}

  try {
    const btnAddCall = document.getElementById('btnAddCall');
    if (btnAddCall) btnAddCall.style.display = inCall ? 'none' : '';
    const btnRecord = document.getElementById('btnRecord');
    if (btnRecord) btnRecord.style.display = inCall ? 'none' : '';
  } catch {}

  try {
    const kbd = document.getElementById('btnToggleKeyboard');
    if (kbd) kbd.style.display = inCall ? 'none' : '';
  } catch {}

  try {
    const rtp = document.getElementById('rtpIndicators');
    rtp?.style?.setProperty('display', inCall ? 'grid' : 'none');
    const isMobile = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(max-width: 480px)').matches;
    rtp?.classList?.toggle('rtpIndicatorsMobile', !!(inCall && isMobile));
  } catch {}

  _ensureRtpIndicatorsUiBound(st);

  if (inCall || hasIncoming) {
    activateDialTab();
  }
  setCallNavigationLock(inCall || hasIncoming);

  if (registered) {
    const currentAccount = st.account || ui.account();
    if (currentAccount?.username && currentAccount?.domain) {
      // Use account display feature to format username and domain separately
      updateUsernameDisplay(currentAccount.username, el.status);
      updateDomainDisplay(currentAccount.domain, el.domainDisplay);
    } else if (currentAccount?.username) {
      updateUsernameDisplay(currentAccount.username, el.status);
      setText(el.domainDisplay, "-");
    } else {
      setText(el.status, "-");
      setText(el.domainDisplay, "-");
    }
  }

  const indicator = document.getElementById("statusIndicator");
  if (indicator) indicator.classList.toggle("connected", registered);
  window.dispatchEvent(new Event("ui:buttons-updated"));
}

export function createUi(st) {
  const d = defaultsFromBody();
  if (el.domain && !el.domain.value) el.domain.value = d.sipDomain;
  if (el.wss && !el.wss.value) el.wss.value = d.wssHost;

  const ui = {
    ext: () => el.ext?.value?.trim(),
    domain: () => el.domain?.value?.trim(),
    domainFallback: () => d.sipDomain,
    account: () => parseSipAccount(el.ext?.value, el.domain?.value, d.sipDomain),
    pass: () => el.pass?.value ?? "",
    wss: () => el.wss?.value,
    wssFallback: () => (window.location?.host || d.wssHost || ""),
    dial: () => el.dial?.value?.trim(),
    // Layout is rendered dynamically, so always resolve the audio element at call time.
    remoteAudio: () => document.getElementById("remoteAudio"),
    setStatus: (s) => {
      const account = st.account || ui.account();
      if (st.registered && account?.username && account?.domain) {
        // Use account display feature to format username and domain separately
        updateUsernameDisplay(account.username, el.status);
        updateDomainDisplay(account.domain, el.domainDisplay);
      } else {
        setText(el.status, s);
        setText(el.domainDisplay, "-");
      }
      document.getElementById("statusIndicator")?.classList.toggle("connected", st.registered);
    },
    setTransport: (s) => setText(el.tstatus, s),
    setButtons: () => updateControlVisibility(st, ui),
  };

  ui.setStatus("Idle");
  ui.setTransport("-");
  ui.setButtons();
  return ui;
}
