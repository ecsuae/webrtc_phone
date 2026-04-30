'use strict';

function corrKey(ev) {
  return ev?.corrId || ev?.callId || '';
}

module.exports = {
  corrKey,
};
