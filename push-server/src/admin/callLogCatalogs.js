'use strict';

const MEDIA_ERROR_DESCRIPTIONS = {
  'MEDIA-E001': 'Relay not found — TURN unreachable in relay-only mode',
  'MEDIA-E002': 'ICE timeout — gathering timed out before relay candidate found',
  'MEDIA-E003': 'Secure media failed — DTLS/SRTP negotiation did not complete',
  'MEDIA-E004': 'No audio received — zero RTP packets on browser leg',
};

const SESSION_EVENT_TYPES = new Set([
  'profile-selected',
  'ua-ice-policy',
  'profile-badge-rendered',
  'profile-toggle-changed',
]);

const SUMMARY_MILESTONE_TYPES = new Set([
  'profile-selected',
  'ua-ice-policy',
  'outbound-preflight-result',
  'invite-sent',
  'ice-complete',
  'remote-audio-attached',
  'remote-audio-play-ok',
  'remote-audio-play-failed',
  'no-remote-audio-play',
  'receive-render-proof',
  'call-established',
  'call-ended',
  'call-log-post-failed',
  'preflight-icecandidateerror',
  'no-inbound-rtp',
  'no-outbound-rtp',
  'dtls-connected-but-no-rtp',
  'selected-pair-relay-mismatch',
  'one-way-audio-suspected',
  'incomplete-observability',
  'outbound-post-establish-probe',
  'outbound-receive-health-2s',
  'outbound-receive-health-5s',
  'outbound-receive-health-10s',
  'outbound-inbound-rtp-zero',
  'outbound-inbound-rtp-present',
  'outbound-selected-pair-details',
  'outbound-dtls-state',
  'outbound-connection-state',
  'outbound-ice-connection-state',
  'probable-lte-receive-path-failure',
]);

const PROBLEM_ROW_TYPES = new Set([
  'one-way-audio-suspected',
  'probable-lte-receive-path-failure',
  'incomplete-observability',
]);

const WARN_ROW_TYPES = new Set([
  'no-inbound-rtp',
  'no-outbound-rtp',
  'dtls-connected-but-no-rtp',
  'remote-audio-play-failed',
  'no-remote-audio-play',
  'selected-pair-relay-mismatch',
]);

module.exports = {
  MEDIA_ERROR_DESCRIPTIONS,
  SESSION_EVENT_TYPES,
  SUMMARY_MILESTONE_TYPES,
  PROBLEM_ROW_TYPES,
  WARN_ROW_TYPES,
};
