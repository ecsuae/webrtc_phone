export const $d = (sel) => document.querySelector(sel);

export const desktopEl = {
  ext: null,
  domain: null,
  pass: null,
  conferencePin: null,
  wss: null,
  dial: null,
  status: null,
  tstatus: null,
  domainDisplay: null,
  remoteAudio: null,
  log: null,

  registrationCard: null,
  dialpadCard: null,

  incomingAlertBanner: null,
  incomingAlertTitle: null,

  btnPassToggle: null,
  btnJoinConference: null,

  btnStart: null,
  btnStop: null,
  btnCall: null,
  btnHangup: null,
  btnAnswer: null,
  btnReject: null,
};

export function refreshDesktopEl() {
  desktopEl.ext = $d("#ext");
  desktopEl.domain = $d("#domain");
  desktopEl.pass = $d("#pass");
  desktopEl.conferencePin = $d("#conferencePin");
  desktopEl.wss = $d("#wsshost");
  desktopEl.dial = $d("#dial");
  desktopEl.status = $d("#status");
  desktopEl.tstatus = $d("#tstatus");
  desktopEl.domainDisplay = $d("#domainDisplay");
  desktopEl.remoteAudio = $d("#remoteAudio");
  desktopEl.log = $d("#log");

  desktopEl.registrationCard = $d("#registrationCard");
  desktopEl.dialpadCard = $d("#dialpadCard");

  desktopEl.incomingAlertBanner = $d("#incomingAlertBanner");
  desktopEl.incomingAlertTitle = $d("#incomingAlertTitle");

  desktopEl.btnPassToggle = $d("#btnPassToggle");
  desktopEl.btnJoinConference = $d("#btnJoinConference");

  desktopEl.btnStart = $d("#btnStart");
  desktopEl.btnStop = $d("#btnStop");
  desktopEl.btnJoinConference = $d("#btnJoinConference");
  desktopEl.btnCall = $d("#btnCall");
  desktopEl.btnHangup = $d("#btnHangup");
  desktopEl.btnAnswer = $d("#btnAnswer");
  desktopEl.btnReject = $d("#btnReject");

  return desktopEl;
}

refreshDesktopEl();
