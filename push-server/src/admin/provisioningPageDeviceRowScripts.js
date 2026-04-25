'use strict';

const DEVICE_SCRIPT = `
async function toggleRevoke(provisioningId, deviceId, rowId, revoked) {
  const btn = document.getElementById(rowId + '_btn');
  const msg = document.getElementById(rowId + '_msg');
  if (btn) btn.disabled = true;
  if (msg) {
    msg.className = 'row-msg';
    msg.textContent = 'Saving...';
  }
  const body = { provisioning_id: provisioningId, device_id: deviceId, revoked: !!revoked };
  try {
    const resp = await fetch('/admin/provisioning/device/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    if (resp.ok && data && data.ok) {
      if (msg) {
        msg.className = 'row-msg ok';
        msg.textContent = revoked ? 'Revoked' : 'Unrevoked';
      }
      if (btn) {
        btn.className = revoked ? 'btn btn-secondary' : 'btn btn-danger';
        btn.textContent = revoked ? 'Unrevoke' : 'Revoke';
        btn.onclick = () => toggleRevoke(provisioningId, deviceId, rowId, !revoked);
      }
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
}
`;

module.exports = { DEVICE_SCRIPT };
