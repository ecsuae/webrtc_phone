'use strict';

const fs = require('fs');

const { accountsPath } = require('./provisioningPaths');

function safeReadAccounts() {
  const filePath = accountsPath();
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.accounts) ? parsed.accounts : []);
  } catch {
    return [];
  }
}

function safeWriteAccounts(accounts) {
  const filePath = accountsPath();
  fs.writeFileSync(filePath, JSON.stringify({ accounts: accounts || [], savedAt: new Date().toISOString() }, null, 2));
  return filePath;
}

function normalizeAccount(incoming) {
  const a = incoming && typeof incoming === 'object' ? { ...incoming } : {};
  const provisioningId = String(a.provisioning_id || a.provisioningId || '').trim();
  if (!provisioningId) return null;

  return {
    provisioning_id: provisioningId,
    label: String(a.label || '').trim(),
    internal_label: String(a.internal_label || '').trim(),
    notes: String(a.notes || '').trim(),

    enabled: a.enabled !== false,
    auto_provision_enabled: a.auto_provision_enabled !== false,
    max_devices: Number.isFinite(Number(a.max_devices)) ? Number(a.max_devices) : 1,

    pin_hash: String(a.pin_hash || '').trim(),
    provisioning_pin: String(a.provisioning_pin || '').trim(),

    display_name: String(a.display_name || '').trim(),
    sip_username: String(a.sip_username || '').trim(),
    sip_password: String(a.sip_password || '').trim(),
    sip_domain: String(a.sip_domain || '').trim(),
    websocket_url: String(a.websocket_url || '').trim(),
    transport: String(a.transport || '').trim(),

    created_at: String(a.created_at || '').trim(),
    updated_at: new Date().toISOString(),
  };
}

function listProvisioningAccounts() {
  return safeReadAccounts();
}

function findProvisioningAccountById(provisioningId) {
  const id = String(provisioningId || '').trim();
  if (!id) return null;
  const all = safeReadAccounts();
  return all.find((a) => String(a?.provisioning_id || '').trim() === id) || null;
}

function upsertProvisioningAccount(account) {
  const normalized = normalizeAccount(account);
  if (!normalized) return { ok: false, error: 'missing-provisioning-id' };

  const all = safeReadAccounts();
  const idx = all.findIndex((a) => String(a?.provisioning_id || '').trim() === normalized.provisioning_id);

  if (idx >= 0) {
    const prev = all[idx] || {};
    all[idx] = {
      ...prev,
      ...normalized,
      created_at: prev.created_at || normalized.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  } else {
    all.push({
      ...normalized,
      created_at: normalized.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  safeWriteAccounts(all);
  return { ok: true, provisioning_id: normalized.provisioning_id };
}

function updateProvisioningAccount(provisioningId, patch) {
  const id = String(provisioningId || '').trim();
  if (!id) return { ok: false, error: 'missing-provisioning-id' };

  const all = safeReadAccounts();
  const idx = all.findIndex((a) => String(a?.provisioning_id || '').trim() === id);
  if (idx < 0) return { ok: false, error: 'not-found' };

  const prev = all[idx] || {};
  const normalized = normalizeAccount({ ...prev, ...(patch || {}), provisioning_id: id }) || null;
  if (!normalized) return { ok: false, error: 'invalid' };

  all[idx] = {
    ...prev,
    ...normalized,
    created_at: prev.created_at || normalized.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  safeWriteAccounts(all);
  return { ok: true, provisioning_id: id };
}

function deleteProvisioningAccount(provisioningId) {
  const id = String(provisioningId || '').trim();
  if (!id) return { ok: false, error: 'missing-provisioning-id' };

  const all = safeReadAccounts();
  const next = all.filter((a) => String(a?.provisioning_id || '').trim() !== id);
  if (next.length === all.length) return { ok: false, error: 'not-found' };

  safeWriteAccounts(next);
  return { ok: true, provisioning_id: id };
}

module.exports = {
  listProvisioningAccounts,
  findProvisioningAccountById,
  upsertProvisioningAccount,
  updateProvisioningAccount,
  deleteProvisioningAccount,
};
