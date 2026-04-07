'use strict';

const { buildLegSummary } = require('./callLogLegSummary');

function deriveAsymmetricDirectionDiagnosis(events) {
  const caller = buildLegSummary(events, 'outbound');
  const callee = buildLegSummary(events, 'inbound');

  const wifi = callee;
  const lteMissing = !caller.any;

  const wifiSendingOk = wifi.any && wifi.outboundRtp === true;
  const wifiReceivingNo = wifi.any && wifi.inboundRtp === false;

  if (wifiSendingOk && wifiReceivingNo && lteMissing) {
    return {
      lines: [
        'Wi-Fi leg sending OK',
        'Wi-Fi leg receiving NO',
        'LTE leg logs missing',
      ],
      problem: 'PROBLEM: LTE receive-leg observability missing; current evidence suggests LTE is not receiving RTP',
    };
  }

  return null;
}

module.exports = {
  deriveAsymmetricDirectionDiagnosis,
};
