import { primeIncomingRingtone } from "../incoming/desktopIncomingAlert.js";
import { startCall } from "../outgoing/desktopStartCall.js";
import { sendDTMF } from "../../util/dtmf.js";
import { desktopEl } from "../ui/desktopDomRefs.js";

function sanitizePin(pin) {
  return String(pin || "").replace(/\s+/g, "").trim();
}

function waitForEstablishedCall(st, timeoutMs = 12000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const session = st.session;
      const state = String(session?.state || "");
      if (state.includes("Established")) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}

async function lookupPin(pin) {
  const resp = await fetch("/api/conference/lookup-pin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin }),
  });

  if (resp.status === 404) {
    return { ok: false, error: "InvalidPin" };
  }

  if (!resp.ok) {
    const text = await resp.text();
    return { ok: false, error: "LookupFailed", status: resp.status, detail: text };
  }

  const data = await resp.json();
  return { ok: true, data };
}

async function joinDetails(joinToken) {
  const resp = await fetch("/api/conference/join-details", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ joinToken }),
  });

  if (resp.status === 401) {
    return { ok: false, error: "TokenExpired" };
  }

  if (!resp.ok) {
    const text = await resp.text();
    return { ok: false, error: "JoinDetailsFailed", status: resp.status, detail: text };
  }

  const data = await resp.json();
  return { ok: true, data };
}

export async function joinDesktopConference({ st, ui, SIP, runOneTapEnableFlow }) {
  const el = desktopEl;
  const pin = sanitizePin(el.conferencePin?.value);
  if (!pin) {
    ui.setStatus("Missing conference PIN");
    return;
  }

  if (st.session) {
    ui.setStatus("Call already active");
    return;
  }

  ui.setStatus("Looking up PIN...");
  console.log("[conf] PIN lookup requested");

  const lookup = await lookupPin(pin);
  if (!lookup.ok) {
    if (lookup.error === "InvalidPin") ui.setStatus("Invalid conference PIN");
    else if (lookup.error === "LookupFailed") ui.setStatus(`PIN lookup failed (${lookup.status || ""})`);
    else ui.setStatus("PIN lookup failed");
    console.log("[conf] PIN lookup failed", lookup);
    return;
  }

  const { joinToken, roomName, role, conferenceExtension } = lookup.data || {};
  if (!joinToken || !conferenceExtension) {
    ui.setStatus("Conference config missing");
    console.log("[conf] PIN lookup returned missing fields");
    return;
  }

  console.log("[conf] PIN lookup success", { roomName, role, conferenceExtension });

  ui.setStatus("Preparing join...");
  const details = await joinDetails(joinToken);
  if (!details.ok) {
    if (details.error === "TokenExpired") ui.setStatus("Conference token expired");
    else ui.setStatus(`Conference join failed (${details.status || ""})`);
    console.log("[conf] join-details failed", details);
    return;
  }

  const guestUser = String(details.data?.guestSip?.username || "").trim();
  const guestPass = String(details.data?.guestSip?.password || "");
  const ext = String(details.data?.conferenceExtension || conferenceExtension || "").trim();

  if (!guestUser || !guestPass || !ext) {
    ui.setStatus("Conference join not configured");
    console.log("[conf] join-details missing required fields");
    return;
  }

  if (el.ext) el.ext.value = guestUser;
  if (el.pass) el.pass.value = guestPass;

  primeIncomingRingtone();
  ui.setStatus("Registering (guest)...");
  console.log("[conf] conference call started (registering)");

  st._skipCredentialPersist = true;
  try {
    await runOneTapEnableFlow();
  } finally {
    st._skipCredentialPersist = false;
  }

  if (!st.registered) {
    ui.setStatus("SIP registration failed");
    console.log("[conf] registration failure");
    return;
  }

  if (el.dial) el.dial.value = ext;
  ui.setStatus("Dialing conference...");
  await startCall(SIP, st, ui);

  const established = await waitForEstablishedCall(st);
  if (!established) {
    ui.setStatus("Conference call failure");
    console.log("[conf] conference call failed to establish");
    return;
  }

  try {
    ui.setStatus("Sending PIN...");
    await sendDTMF(st.session, `${pin}#`);
    console.log("[conf] DTMF PIN sent");
  } catch (err) {
    console.log("[conf] DTMF send failure", err);
    ui.setStatus("DTMF send failure");
    return;
  }

  ui.setStatus("Joined conference");
  console.log("[conf] conference join completed");
}