/* app.js
 * WebPhone (SIP.js 0.21.x)
 * - Register via WSS (Kamailio) -> FusionPBX
 * - Outbound calling (Inviter)
 * - Logs transport + registerer + ICE candidates + selected pair
 *
 * NOTE ABOUT YOUR ONE-SIDED-AUDIO:
 * - Use FORCE_RELAY = true for one test call.
 *   If 2-way audio works with FORCE_RELAY, then it’s ICE/NAT selection.
 *
 * Expected HTML IDs:
 *  #ext       (input)
 *  #domain    (input)
 *  #pass      (input)
 *  #wsshost   (input) optional, default phone.srve.cc
 *  #dial      (input) destination
 *  #btnStart  (button)
 *  #btnStop   (button) optional
 *  #btnCall   (button)
 *  #btnHangup (button)
 *  #status    (span/div)
 *  #tstatus   (span/div)
 *  #remoteAudio (audio element)
 *  #log       (pre/div) optional
 */

/* ========================================================================
 *  [1] SETTINGS
 * ====================================================================== */

const SHOW_PASSWORD = false; // set true only for debugging (NOT recommended)
const G711_ONLY = true; // enforce G711 (PCMU/PCMA) only

// IMPORTANT:
// If FORCE_RELAY = true and audio becomes 2-way, the problem is ICE candidate selection/NAT.
// Keep it false for normal operation.
const FORCE_RELAY = true;

// ICE transport policy:
// - "all" = allow host/srflx/relay
// - "relay" = force TURN only (debug)
const ICE_TRANSPORT_POLICY = FORCE_RELAY ? "relay" : "all";

// TURN/STUN for media (coturn on phone.srve.cc)
// DO NOT include turns:5349 unless you have TLS TURN working (your logs show TLS cert/key not set properly).
const ICE_SERVERS = [
  { urls: ["stun:phone.srve.cc:3478"] },
  {
    urls: [
      "turn:phone.srve.cc:3478?transport=udp",
      "turn:phone.srve.cc:3478?transport=tcp",
    ],
    username: "turnuser",
    credential: "turnpass",
  },
];

const G711_CODECS = new Set(["pcmu", "pcma", "telephone-event"]);

/* ========================================================================
 *  [2] DOM / UI HELPERS
 * ====================================================================== */

function nowISO() {
  return new Date().toISOString();
}

function $(id) {
  return document.querySelector(id);
}

function setText(el, text) {
  if (!el) return;
  el.textContent = text;
}

function logLine(...args) {
  const msg = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  console.log(msg);

  const logEl = $("#log");
  if (logEl) {
    logEl.textContent += msg + "\n";
    if (logEl.scrollHeight) logEl.scrollTop = logEl.scrollHeight;
  }
}

function maskPassword(p) {
  if (!p) return "";
  if (SHOW_PASSWORD) return p;
  if (p.length <= 2) return "*".repeat(p.length);
  return `${p.slice(0, 2)}****${p.slice(-1)} (len=${p.length})`;
}

function formatSipResponse(response) {
  if (!response) return "";
  const msg = response.message || response;
  const code = msg?.statusCode || response.statusCode;
  const reason = msg?.reasonPhrase || response.reasonPhrase;
  if (!code && !reason) return "";
  return `${code || ""} ${reason || ""}`.trim();
}

/* ========================================================================
 *  [3] MEDIA HELPERS (MIC + REMOTE AUDIO)
 * ====================================================================== */

let localAudioStream = null;

const elRemoteAudio = $("#remoteAudio");

function playRemoteAudio() {
  if (!elRemoteAudio) return;
  const p = elRemoteAudio.play();
  if (p && typeof p.catch === "function") p.catch(() => {});
}

function stopLocalAudioStream() {
  if (!localAudioStream) return;
  localAudioStream.getTracks().forEach((t) => t.stop());
  localAudioStream = null;
  logLine(`[${nowISO()}] [media] microphone stream stopped`);
}

async function ensureMicAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    logLine(`[${nowISO()}] [media] getUserMedia not available`);
    return false;
  }
  if (localAudioStream) return true;

  try {
    localAudioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    logLine(`[${nowISO()}] [media] microphone permission granted`);
    return true;
  } catch (e) {
    logLine(`[${nowISO()}] [media] microphone permission denied`, e?.message || e);
    setStatus("Microphone permission denied");
    return false;
  }
}

/* ========================================================================
 *  [4] SDP HELPERS (G711 FILTER)
 * ====================================================================== */

function filterSdpToG711(sdp) {
  if (!sdp || typeof sdp !== "string") return sdp;
  const lines = sdp.split(/\r\n/);
  const mLineIndexes = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].startsWith("m=")) mLineIndexes.push(i);
  }

  const audioIndex = mLineIndexes.find((i) => lines[i].startsWith("m=audio "));
  if (audioIndex === undefined) return sdp;

  const audioEnd = mLineIndexes.find((i) => i > audioIndex) ?? lines.length;
  const audioLines = lines.slice(audioIndex, audioEnd);

  const allowedPayloads = new Set();
  audioLines.forEach((line) => {
    if (!line.startsWith("a=rtpmap:")) return;
    const parts = line.slice("a=rtpmap:".length).split(" ");
    const payload = parts[0];
    const codec = (parts[1] || "").split("/")[0].toLowerCase();
    if (G711_CODECS.has(codec)) allowedPayloads.add(payload);
  });

  if (allowedPayloads.size === 0) return sdp;

  const mParts = audioLines[0].split(" ");
  const mPrefix = mParts.slice(0, 3);
  const newPayloads = mParts.slice(3).filter((pt) => allowedPayloads.has(pt));
  if (newPayloads.length === 0) return sdp;

  const filteredAudio = [];
  filteredAudio.push([...mPrefix, ...newPayloads].join(" "));

  for (let i = 1; i < audioLines.length; i += 1) {
    const line = audioLines[i];

    if (line.startsWith("a=rtpmap:")) {
      const payload = line.slice("a=rtpmap:".length).split(" ")[0];
      if (allowedPayloads.has(payload)) filteredAudio.push(line);
      continue;
    }

    if (line.startsWith("a=fmtp:") || line.startsWith("a=rtcp-fb:")) {
      const payload = line.split(":")[1]?.split(" ")[0];
      if (payload && allowedPayloads.has(payload)) filteredAudio.push(line);
      continue;
    }

    filteredAudio.push(line);
  }

  const output = [...lines.slice(0, audioIndex), ...filteredAudio, ...lines.slice(audioEnd)];
  return output.join("\r\n");
}

function g711OnlyModifier(sessionDescription) {
  if (!G711_ONLY || !sessionDescription?.sdp) return sessionDescription;
  const filtered = filterSdpToG711(sessionDescription.sdp);
  return Promise.resolve({ type: sessionDescription.type, sdp: filtered });
}

/* ========================================================================
 *  [5] ICE DEBUG HELPERS (CANDIDATE TYPES + SELECTED PAIR)
 * ====================================================================== */

function parseCandidateType(candidateStr) {
  if (!candidateStr) return "unknown";
  const m = candidateStr.match(/\btyp\s(\w+)/);
  return m ? m[1] : "unknown";
}

function shortCandidate(candidateStr) {
  if (!candidateStr) return "";
  return candidateStr.length > 140 ? candidateStr.slice(0, 140) + "..." : candidateStr;
}

/* ========================================================================
 *  [6] SIP STATE (UA / REGISTER / CALL SESSION)
 * ====================================================================== */

let userAgent = null;
let registerer = null;
let registered = false;
let registering = false;
let activeSession = null;

/* ========================================================================
 *  [7] UI REFERENCES
 * ====================================================================== */

const elExt = $("#ext");
const elDomain = $("#domain");
const elPass = $("#pass");
const elWss = $("#wsshost");

const elStatus = $("#status");
const elTransport = $("#tstatus");
const elDial = $("#dial");

const btnRegister = $("#btnStart");
const btnUnregister = $("#btnStop");
const btnCall = $("#btnCall");
const btnHangup = $("#btnHangup");

/* ========================================================================
 *  [8] UI STATE UPDATERS
 * ====================================================================== */

function setStatus(s) {
  setText(elStatus, s);
}

function setTransport(s) {
  setText(elTransport, s);
}

function setButtons() {
  // Two buttons style
  if (btnRegister && btnUnregister) {
    btnRegister.disabled = registered;
    btnUnregister.disabled = !registered;
  }

  // One button toggle style
  if (btnRegister && !btnUnregister) {
    btnRegister.textContent = registered ? "Unregister" : "Register";
  }

  if (btnCall) btnCall.disabled = !registered || !!activeSession;
  if (btnHangup) btnHangup.disabled = !activeSession;
}

/* ========================================================================
 *  [9] SIP: START / REGISTER
 * ====================================================================== */

function normalizeWssServer(value) {
  const raw = (value || "").trim();
  if (!raw) return "wss://phone.srve.cc/ws";
  if (raw.startsWith("ws://") || raw.startsWith("wss://")) return raw;
  return `wss://${raw.replace(/\/$/, "")}/ws`;
}

async function startAndRegister() {
  const ext = elExt?.value?.trim();
  const domain = elDomain?.value?.trim();
  const password = elPass?.value ?? "";
  const wss = normalizeWssServer(elWss?.value);

  logLine(`[${nowISO()}] [boot] startAndRegister clicked`);
  logLine(`[${nowISO()}] [debug] ext=${ext}`);
  logLine(`[${nowISO()}] [debug] domain=${domain}`);
  logLine(`[${nowISO()}] [debug] password=${maskPassword(password)}`);
  logLine(`[${nowISO()}] [debug] uri=sip:${ext}@${domain}`);
  logLine(`[${nowISO()}] [debug] wss=${wss}`);
  logLine(`[${nowISO()}] [debug] ICE policy=${ICE_TRANSPORT_POLICY} FORCE_RELAY=${FORCE_RELAY}`);

  if (!ext || !domain || !password) {
    setStatus("Missing ext/domain/password");
    return;
  }

  // Clean restart if already running
  if (userAgent) {
    await stopAndUnregister(true);
  }

  const uri = SIP.UserAgent.makeURI(`sip:${ext}@${domain}`);
  if (!uri) {
    setStatus("Invalid SIP URI");
    return;
  }

  // SIP.js logs
  if (SIP.Logger && SIP.LogLevel) {
    SIP.Logger.level = SIP.LogLevel.debug;
  }

  setStatus("Starting...");
  setTransport("Connecting...");

  userAgent = new SIP.UserAgent({
    uri,
    authorizationUsername: ext,
    authorizationPassword: password,
    transportOptions: {
      server: wss,
    },

    // IMPORTANT: Put ICE config here so it applies consistently to all sessions
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration: {
        iceServers: ICE_SERVERS,
        iceTransportPolicy: ICE_TRANSPORT_POLICY,
      },
    },
  });

  // Transport state logs
  if (userAgent.transport?.stateChange?.addListener) {
    userAgent.transport.stateChange.addListener((state) => {
      logLine(`[${nowISO()}] [transport] ${state}`);
      setTransport(String(state));

      const s = String(state).toLowerCase();
      if (s.includes("connected") && !registered) setStatus("Connected (not registered)");
      if (s.includes("disconnected")) setStatus("Disconnected");
      if (s.includes("connecting")) setStatus("Connecting...");
    });
  }

  // Start UA (opens websocket)
  try {
    await userAgent.start();
    logLine(`[${nowISO()}] [debug] ua.start() done`);
  } catch (e) {
    logLine(`[${nowISO()}] [error] ua.start() failed`, e?.message || e);
    setStatus("UA start failed");
    setTransport("-");
    userAgent = null;
    return;
  }

  // Registerer
  registerer = new SIP.Registerer(userAgent, {
    delegate: {
      onAccept: (response) => {
        const info = formatSipResponse(response);
        logLine(`[${nowISO()}] [registerer] accepted ${info}`.trim());
        registered = true;
        registering = false;
        setStatus(info ? `Registered (${info})` : "Registered");
        setButtons();
      },
      onReject: (response) => {
        const info = formatSipResponse(response);
        logLine(`[${nowISO()}] [registerer] rejected ${info}`.trim());
        registered = false;
        registering = false;
        setStatus(info ? `Register failed (${info})` : "Register failed");
        setButtons();
      },
    },
  });

  if (registerer.stateChange?.addListener) {
    registerer.stateChange.addListener((state) => {
      logLine(`[${nowISO()}] [registerer] ${state}`);
      const st = String(state).toLowerCase();

      if (st.includes("registered")) {
        registered = true;
        registering = false;
        setStatus("Registered");
        setButtons();
      } else if (st.includes("unregistered") || st.includes("terminated")) {
        registered = false;
        if (registering) setStatus("Register failed (no response)");
        else setStatus("Unregistered");
        registering = false;
        setButtons();
      } else {
        setStatus(String(state));
      }
    });
  }

  try {
    registering = true;
    registerer.register();
    logLine(`[${nowISO()}] [debug] register() called`);
    setStatus("Registering...");
  } catch (e) {
    registering = false;
    logLine(`[${nowISO()}] [error] register() failed`, e?.message || e);
    setStatus("Register failed");
  }

  setButtons();
}

/* ========================================================================
 *  [10] SIP: STOP / UNREGISTER
 * ====================================================================== */

async function stopAndUnregister(silent = false) {
  if (!silent) logLine(`[${nowISO()}] [boot] stopAndUnregister clicked`);

  if (activeSession) {
    try {
      await hangupCall(true);
    } catch (e) {}
  }

  try {
    if (registerer) {
      try {
        await registerer.unregister();
        logLine(`[${nowISO()}] [debug] unregister() sent`);
      } catch (e) {}
    }
  } finally {
    registered = false;
    setButtons();
    setStatus("Stopping...");
  }

  try {
    if (userAgent) {
      await userAgent.stop();
      logLine(`[${nowISO()}] [debug] ua.stop() done`);
    }
  } catch (e) {
    logLine(`[${nowISO()}] [warn] ua.stop() error`, e?.message || e);
  }

  userAgent = null;
  registerer = null;

  stopLocalAudioStream();

  setStatus("Idle");
  setTransport("-");
  setButtons();
}

/* ========================================================================
 *  [11] CALLS: PEER CONNECTION BINDING + REMOTE AUDIO
 * ====================================================================== */

function attachRemoteAudio(session) {
  if (!session || !elRemoteAudio) return;

  const sdh = session.sessionDescriptionHandler;
  const pc = sdh && sdh.peerConnection;
  if (!pc) return;

  const remoteStream = new MediaStream();
  pc.getReceivers().forEach((receiver) => {
    if (receiver.track) remoteStream.addTrack(receiver.track);
  });

  if (remoteStream.getTracks().length > 0) {
    elRemoteAudio.srcObject = remoteStream;
    playRemoteAudio();
  }
}

function bindPeerConnection(session, label) {
  const sdh = session?.sessionDescriptionHandler;
  const pc = sdh && sdh.peerConnection;
  if (!pc || pc.__bound) return;

  pc.__bound = true;

  pc.addEventListener("track", (event) => {
    logLine(`[${nowISO()}] [pc:${label}] track`);
    if (!elRemoteAudio) return;

    const stream = event.streams && event.streams[0] ? event.streams[0] : null;
    if (stream) {
      elRemoteAudio.srcObject = stream;
      playRemoteAudio();
    } else {
      attachRemoteAudio(session);
    }
  });

  pc.addEventListener("icegatheringstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] gather=${pc.iceGatheringState}`);
  });

  pc.addEventListener("icecandidate", (event) => {
    if (event.candidate?.candidate) {
      const c = event.candidate.candidate;
      const typ = parseCandidateType(c);
      logLine(`[${nowISO()}] [pc:${label}] candidate typ=${typ} ${shortCandidate(c)}`);
    } else {
      logLine(`[${nowISO()}] [pc:${label}] ICE gathering complete`);
    }
  });

  pc.addEventListener("icecandidateerror", (event) => {
    logLine(
      `[${nowISO()}] [pc:${label}] icecandidateerror code=${event.errorCode} text=${event.errorText || ""}`
    );
  });

  pc.addEventListener("iceconnectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] ice=${pc.iceConnectionState}`);

    // On connected/completed -> log selected candidate pair
    if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
      pc.getStats(null)
        .then((stats) => {
          let selectedPair = null;
          stats.forEach((r) => {
            if (r.type === "candidate-pair" && r.selected) selectedPair = r;
          });
          if (!selectedPair) return;

          const local = stats.get(selectedPair.localCandidateId);
          const remote = stats.get(selectedPair.remoteCandidateId);

          if (local && remote) {
            logLine(
              `[${nowISO()}] [pc:${label}] SELECTED local=${local.candidateType} ${local.address}:${local.port} | remote=${remote.candidateType} ${remote.address}:${remote.port}`
            );
          }
        })
        .catch(() => {});
    }
  });

  pc.addEventListener("connectionstatechange", () => {
    logLine(`[${nowISO()}] [pc:${label}] conn=${pc.connectionState}`);
  });
}

function setupSessionHandlers(session, label) {
  if (!session) return;

  bindPeerConnection(session, label);

  session.stateChange.addListener((state) => {
    logLine(`[${nowISO()}] [session:${label}] ${state}`);

    bindPeerConnection(session, label);

    if (state === SIP.SessionState.Established) {
      attachRemoteAudio(session);
    }

    if (state === SIP.SessionState.Terminated) {
      if (activeSession === session) activeSession = null;
      if (elRemoteAudio) elRemoteAudio.srcObject = null;
      stopLocalAudioStream();
      setButtons();
    }
  });
}

/* ========================================================================
 *  [12] CALLS: OUTBOUND DIAL + HANGUP
 * ====================================================================== */

async function startCall() {
  const target = elDial?.value?.trim();

  if (!registered || !userAgent) {
    setStatus("Not registered");
    return;
  }
  if (!target) {
    setStatus("Missing destination");
    return;
  }
  if (activeSession) {
    setStatus("Call already active");
    return;
  }

  const micOk = await ensureMicAccess();
  if (!micOk) return;

  const domain = elDomain?.value?.trim();
  const targetUri = SIP.UserAgent.makeURI(`sip:${target}@${domain}`);
  if (!targetUri) {
    setStatus("Invalid destination");
    return;
  }

  logLine(`[${nowISO()}] [call] dialing ${targetUri.toString()}`);
  logLine(`[${nowISO()}] [call] ICE policy=${ICE_TRANSPORT_POLICY} (FORCE_RELAY=${FORCE_RELAY})`);

  // IMPORTANT: Keep RTC config centralized in UA factory options.
  // This avoids SIP.js applying different rtc configs for different sessions.
  const inviter = new SIP.Inviter(userAgent, targetUri, {
    sessionDescriptionHandlerModifiers: G711_ONLY ? [g711OnlyModifier] : undefined,
    sessionDescriptionHandlerOptions: {
      constraints: { audio: true, video: false },
      localMediaStream: localAudioStream || undefined,
    },
  });

  activeSession = inviter;
  setupSessionHandlers(inviter, "outbound");
  setButtons();

  try {
    await inviter.invite();
    logLine(`[${nowISO()}] [call] invite sent`);
  } catch (e) {
    logLine(`[${nowISO()}] [error] invite failed`, e?.message || e);
    activeSession = null;
    setButtons();
  }
}

async function hangupCall(silent = false) {
  if (!activeSession) return;

  const session = activeSession;
  if (!silent) logLine(`[${nowISO()}] [call] hangup`);

  try {
    if (session.state === SIP.SessionState.Established) {
      await session.bye();
    } else {
      await session.cancel();
    }
  } catch (e) {
    logLine(`[${nowISO()}] [warn] hangup failed`, e?.message || e);
  } finally {
    stopLocalAudioStream();
  }
}

/* ========================================================================
 *  [13] UI WIRING
 * ====================================================================== */

function wireUI() {
  if (elWss && !elWss.value) elWss.value = "phone.srve.cc";

  setStatus("Idle");
  setTransport("-");
  setButtons();

  // Two buttons mode
  if (btnRegister && btnUnregister) {
    btnRegister.addEventListener("click", () => startAndRegister());
    btnUnregister.addEventListener("click", () => stopAndUnregister(false));
  } else if (btnRegister) {
    // One button toggle mode
    btnRegister.addEventListener("click", async () => {
      if (!registered) return startAndRegister();
      return stopAndUnregister(false);
    });
  }

  if (btnCall) btnCall.addEventListener("click", () => startCall());
  if (btnHangup) btnHangup.addEventListener("click", () => hangupCall(false));

  if (elDial) {
    elDial.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        startCall();
      }
    });
  }

  if (elPass) {
    elPass.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (!registered) startAndRegister();
      }
    });
  }
}

/* ========================================================================
 *  [14] BOOT
 * ====================================================================== */

logLine(`[${nowISO()}] [boot] app.js loaded`);
wireUI();