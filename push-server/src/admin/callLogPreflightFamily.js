'use strict';

function isPreflightFamily(ev) {
  const t = (ev.type || '');
  return t === 'outbound-preflight-start'
    || t === 'outbound-preflight-complete'
    || t === 'outbound-preflight-result'
    || t === 'preflight-complete'
    || t === 'preflight-ok'
    || t === 'preflight-fail';
}

module.exports = {
  isPreflightFamily,
};
