const crypto = require('crypto');

function hashPin(pin, pepper) {
  const cleanPin = typeof pin === 'string' ? pin.replace(/\s+/g, '').trim() : '';
  if (!cleanPin) return '';
  const pep = typeof pepper === 'string' ? pepper : '';
  return crypto.createHash('sha256').update(`${cleanPin}:${pep}`, 'utf8').digest('hex');
}

module.exports = { hashPin };
