'use strict';
/**
 * routingConfig.js
 *
 * Reads and writes routing-config.json — the authoritative source for PBX domain
 * mappings and trusted SIP sources managed via the admin UI.
 *
 * The JSON file is mounted into the push-server container via docker-compose.
 * To apply saved changes: run `make routing-apply` on the host, then restart kamailio.
 */

const fs = require('fs');
const path = require('path');

// Mount point matches docker-compose volume: ./routing-config.json:/app/routing-config.json
const CONFIG_PATH = process.env.ROUTING_CONFIG_PATH || path.join(process.cwd(), 'routing-config.json');

function _empty() {
  return { pbxMappings: [], trustedIps: [], trustedDomains: [], savedAt: null };
}

/**
 * Read saved routing config from routing-config.json.
 * Returns empty structure if file does not exist or is unreadable.
 */
function readRoutingConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return _empty();
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      pbxMappings: Array.isArray(parsed.pbxMappings) ? parsed.pbxMappings : [],
      trustedIps: Array.isArray(parsed.trustedIps) ? parsed.trustedIps : [],
      trustedDomains: Array.isArray(parsed.trustedDomains) ? parsed.trustedDomains : [],
      savedAt: parsed.savedAt || null,
    };
  } catch (e) {
    console.error('[routingConfig] Failed to read routing-config.json:', e.message);
    return _empty();
  }
}

/**
 * Write routing config to routing-config.json.
 * Overwrites the entire file. Stamps savedAt timestamp.
 */
function writeRoutingConfig(config) {
  const toWrite = {
    _comment: 'Managed by admin UI. To apply: make routing-apply && docker compose restart kamailio',
    pbxMappings: config.pbxMappings || [],
    trustedIps: config.trustedIps || [],
    trustedDomains: config.trustedDomains || [],
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(toWrite, null, 2) + '\n', 'utf8');
  return toWrite.savedAt;
}

/**
 * Read currently loaded PBX mappings and trusted sources from process.env.
 * These are the values that are active in Kamailio right now.
 */
function readCurrentEnvConfig() {
  const pbxMappings = [];
  const trustedIps = [];
  const trustedDomains = [];

  for (let i = 1; i <= 8; i++) {
    const domain = (process.env[`PBX_MAP_${i}_DOMAIN`] || '').trim();
    const host = (process.env[`PBX_MAP_${i}_HOST`] || '').trim();
    if (domain && host) {
      pbxMappings.push({ domain, host, label: '' });
    }
  }

  for (let i = 1; i <= 8; i++) {
    const ip = (process.env[`TRUSTED_SIP_IP_${i}`] || '').trim();
    if (ip) trustedIps.push({ ip, label: '' });
  }

  for (let i = 1; i <= 8; i++) {
    const domain = (process.env[`TRUSTED_SIP_DOMAIN_${i}`] || '').trim();
    if (domain) trustedDomains.push({ domain, label: '' });
  }

  return {
    pbxMappings,
    trustedIps,
    trustedDomains,
    // Read-only context values shown on the page
    primaryPbxIp: (process.env.PBX_IP || '').trim(),
    primaryPbxPort: (process.env.PBX_PORT || '5060').trim(),
    publicIp: (process.env.PUBLIC_IP || process.env.KAM_PUBLIC_IP || '').trim(),
    domain: (process.env.DOMAIN || '').trim(),
  };
}

/**
 * Validate a routing config payload from the API.
 * Returns array of error strings (empty = valid).
 */
function validateRoutingConfig({ pbxMappings, trustedIps, trustedDomains }) {
  const errors = [];
  const domainRe = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
  const ipRe = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!Array.isArray(pbxMappings)) { errors.push('pbxMappings must be an array'); return errors; }
  if (!Array.isArray(trustedIps)) { errors.push('trustedIps must be an array'); return errors; }
  if (!Array.isArray(trustedDomains)) { errors.push('trustedDomains must be an array'); return errors; }

  if (pbxMappings.length > 8) errors.push('Maximum 8 PBX mappings allowed');
  if (trustedIps.length > 8) errors.push('Maximum 8 trusted IPs allowed');
  if (trustedDomains.length > 8) errors.push('Maximum 8 trusted domains allowed');

  pbxMappings.forEach((m, i) => {
    if (!m.domain || !domainRe.test(m.domain)) errors.push(`PBX mapping [${i}]: invalid domain "${m.domain}"`);
    if (!m.host || (!domainRe.test(m.host) && !ipRe.test(m.host))) errors.push(`PBX mapping [${i}]: invalid host "${m.host}"`);
  });

  trustedIps.forEach((t, i) => {
    if (!t.ip || !ipRe.test(t.ip)) errors.push(`Trusted IP [${i}]: invalid IPv4 "${t.ip}"`);
    // Basic range check
    if (ipRe.test(t.ip)) {
      const parts = t.ip.split('.').map(Number);
      if (parts.some(p => p > 255)) errors.push(`Trusted IP [${i}]: octet out of range in "${t.ip}"`);
    }
  });

  trustedDomains.forEach((t, i) => {
    if (!t.domain || !domainRe.test(t.domain)) errors.push(`Trusted domain [${i}]: invalid domain "${t.domain}"`);
  });

  return errors;
}

module.exports = { readRoutingConfig, writeRoutingConfig, readCurrentEnvConfig, validateRoutingConfig };
