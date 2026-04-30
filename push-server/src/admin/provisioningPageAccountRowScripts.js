'use strict';

const ROW_SCRIPT = `
function syncEnabledLabel(rowId) {
  const cb = document.getElementById(rowId + '_enabled');
  const lbl = document.getElementById(rowId + '_enabled_lbl');
  if (!cb || !lbl) return;
  lbl.textContent = cb.checked ? 'enabled' : 'revoked';
}

function bindEnabledLabel(rowId) {
  const cb = document.getElementById(rowId + '_enabled');
  if (!cb) return;
  if (cb.__enabledLabelBound) return;
  cb.__enabledLabelBound = true;
  syncEnabledLabel(rowId);
  cb.addEventListener('change', () => syncEnabledLabel(rowId));
}

try {
  window.addEventListener('DOMContentLoaded', () => {
    const all = Array.from(document.querySelectorAll('input[type="checkbox"][id$="_enabled"]'));
    for (const cb of all) {
      const id = String(cb?.id || '');
      if (!id.endsWith('_enabled')) continue;
      const rowId = id.slice(0, -('_enabled'.length));
      bindEnabledLabel(rowId);
    }
  });
} catch {}

function editProvRow(rowId) {
  const editBtn = document.getElementById(rowId + '_editbtn');
  const saveBtn = document.getElementById(rowId + '_btn');
  const editing = editBtn && editBtn.textContent === 'Cancel';
  const nextEditing = !editing;
  const fields = [
    rowId + '_label',
    rowId + '_internal',
    rowId + '_enabled',
    rowId + '_auto',
    rowId + '_max',
    rowId + '_sip_user',
    rowId + '_sip_domain',
    rowId + '_ws',
  ];
  for (const id of fields) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.disabled = !nextEditing;
  }
  if (saveBtn) saveBtn.disabled = !nextEditing;
  if (editBtn) editBtn.textContent = nextEditing ? 'Cancel' : 'Edit';
}

function toggleProvPin(rowId) {
  const maskEl = document.getElementById(rowId + '_pin_mask');
  const valEl = document.getElementById(rowId + '_pin_val');
  const btn = document.getElementById(rowId + '_pinshow');
  if (!maskEl || !valEl || !btn) return;

  const showing = valEl.style.display !== 'none';
  if (showing) {
    valEl.style.display = 'none';
    maskEl.style.display = '';
    btn.textContent = '👁';
  } else {
    maskEl.style.display = 'none';
    valEl.style.display = '';
    btn.textContent = 'Hide';
  }
}

async function saveProvRow(provisioningId, rowId) {
  const btn = document.getElementById(rowId + '_btn');
  const msg = document.getElementById(rowId + '_msg');
  const editBtn = document.getElementById(rowId + '_editbtn');

  const labelEl = document.getElementById(rowId + '_label');
  const internalEl = document.getElementById(rowId + '_internal');
  const enabledEl = document.getElementById(rowId + '_enabled');
  const autoEl = document.getElementById(rowId + '_auto');
  const maxEl = document.getElementById(rowId + '_max');
  const sipUserEl = document.getElementById(rowId + '_sip_user');
  const sipDomainEl = document.getElementById(rowId + '_sip_domain');
  const wsEl = document.getElementById(rowId + '_ws');
  if (btn) btn.disabled = true;
  if (editBtn) editBtn.disabled = true;
  if (msg) {
    msg.className = 'row-msg';
    msg.textContent = 'Saving...';
  }
  const body = {
    provisioning_id: provisioningId,
    label: String((labelEl && labelEl.value) || '').trim(),
    internal_label: String((internalEl && internalEl.value) || '').trim(),
    enabled: !!(enabledEl && enabledEl.checked),
    auto_provision_enabled: !!(autoEl && autoEl.checked),
    max_devices: Number(maxEl && maxEl.value),
    sip_username: String((sipUserEl && sipUserEl.value) || '').trim(),
    sip_domain: String((sipDomainEl && sipDomainEl.value) || '').trim(),
    websocket_url: String((wsEl && wsEl.value) || '').trim(),
  };
  try {
    const resp = await fetch('/admin/provisioning/account/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (resp.ok && data && data.ok) {
      if (msg) {
        msg.className = 'row-msg ok';
        msg.textContent = 'Saved';
      }
      setTimeout(() => window.location.reload(), 250);
    } else {
      const errs = (data && data.errors) ? data.errors.join('; ') : (data && data.error) ? data.error : 'Update failed';
      if (msg) {
        msg.className = 'row-msg err';
        msg.textContent = errs;
      }
    }
  } catch (e) {
    if (msg) {
      msg.className = 'row-msg err';
      msg.textContent = 'Request failed';
    }
  }
  if (btn) btn.disabled = false;
  if (editBtn) editBtn.disabled = false;
}

async function resetProvPin(provisioningId, rowId) {
  const newPin = randDigits(4);
  const btn = document.getElementById(rowId + '_pinbtn');
  const msg = document.getElementById(rowId + '_msg');
  if (btn) btn.disabled = true;
  if (msg) { msg.className = 'row-msg'; msg.textContent = 'Saving...'; }
  try {
    const resp = await fetch('/admin/provisioning/account/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provisioning_id: provisioningId, new_pin: String(newPin || '').trim() }),
    });
    const data = await resp.json();
    if (resp.ok && data && data.ok) {
      if (msg) {
        msg.className = 'row-msg ok';
        msg.textContent = 'New PIN: ' + String(newPin) + ' — copy now; it will not be shown again.';
      }

      const pinValEl = document.getElementById(rowId + '_pin_val');
      const pinMaskEl = document.getElementById(rowId + '_pin_mask');
      const pinBtn = document.getElementById(rowId + '_pinshow');
      if (pinValEl) pinValEl.textContent = String(newPin);
      if (pinValEl) pinValEl.style.display = 'none';
      if (pinMaskEl) pinMaskEl.style.display = '';
      if (pinBtn) pinBtn.disabled = false;
      if (pinBtn) pinBtn.textContent = '👁';
    }
    else {
      const errs = (data && data.errors) ? data.errors.join('; ') : (data && data.error_code) ? data.error_code : 'Update failed';
      if (msg) { msg.className = 'row-msg err'; msg.textContent = errs; }
    }
  } catch (e) {
    if (msg) { msg.className = 'row-msg err'; msg.textContent = 'Request failed'; }
  }
  if (btn) btn.disabled = false;
}

async function deleteProvAccount(provisioningId, rowId) {
  if (!confirm('Delete provisioning account ' + provisioningId + '? This will also delete its devices.')) return;
  const btn = document.getElementById(rowId + '_delbtn');
  const msg = document.getElementById(rowId + '_msg');
  if (btn) btn.disabled = true;
  if (msg) { msg.className = 'row-msg'; msg.textContent = 'Deleting...'; }
  try {
    const resp = await fetch('/admin/provisioning/account/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provisioning_id: provisioningId }),
    });
    const data = await resp.json();
    if (resp.ok && data && data.ok) {
      if (msg) { msg.className = 'row-msg ok'; msg.textContent = 'Deleted'; }
      setTimeout(() => window.location.reload(), 250);
    } else {
      const errs = (data && data.errors) ? data.errors.join('; ') : (data && data.error_code) ? data.error_code : 'Delete failed';
      if (msg) { msg.className = 'row-msg err'; msg.textContent = errs; }
    }
  } catch (e) {
    if (msg) { msg.className = 'row-msg err'; msg.textContent = 'Request failed'; }
  }
  if (btn) btn.disabled = false;
}
`;

module.exports = { ROW_SCRIPT };
