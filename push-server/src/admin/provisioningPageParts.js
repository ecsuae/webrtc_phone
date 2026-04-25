'use strict';
const { CLIENT_SCRIPT } = require('./provisioningPageScripts');

function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function toFlag(v) {
  return v === true ? 'true' : v === false ? 'false' : '';
}
function enabledStatusLabel(v) {
  return v === false ? 'Disabled / Revoked' : 'Enabled';
}
function disabledAttr(v) {
  return v ? '' : 'disabled';
}
function countDevices(devices, provisioningId) {
  const pid = String(provisioningId || '').trim();
  const all = Array.isArray(devices) ? devices : [];
  const mine = pid ? all.filter((d) => String(d?.provisioning_id || '').trim() === pid) : [];
  const revoked = mine.filter((d) => d?.revoked === true).length;
  return { total: mine.length, revoked };
}
function deviceRowId(d) {
  const pid = String(d?.provisioning_id || '');
  const did = String(d?.device_id || '');
  return `dev_${(pid + '__' + did).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
}
function renderProvisioningAccountRows({ rows, devices }) {
  return rows.length === 0
    ? '<tr><td colspan="13" class="muted">No provisioning accounts found.</td></tr>'
    : rows
        .map((a) => {
          const pid = String(a?.provisioning_id || '');
          const rowId = `prov_${pid.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
          const canEdit = false;
          const c = countDevices(devices, pid);
          const pin = String(a?.provisioning_pin || '').trim();
          const enabledText = a?.enabled === true ? 'enabled' : 'revoked';
          const accountRevokedText = a?.enabled === false ? 'Yes' : 'No';
          return `<tr>
                <td style="font-family:monospace">${h(pid)}</td>
                <td>
                  <div class="row-actions" style="gap:8px">
                    <span id="${h(rowId)}_pin_mask" style="font-family:monospace">••••</span>
                    <span id="${h(rowId)}_pin_val" style="display:none;font-family:monospace">${h(pin)}</span>
                    <button class="btn btn-secondary" type="button" id="${h(rowId)}_pinshow" onclick="toggleProvPin('${h(rowId)}')" ${pin ? '' : 'disabled'}>👁</button>
                  </div>
                </td>
                <td><input id="${h(rowId)}_label" type="text" value="${h(a?.label || '')}" ${disabledAttr(canEdit)}></td>
                <td><input id="${h(rowId)}_internal" type="text" value="${h(a?.internal_label || '')}" ${disabledAttr(canEdit)}></td>
                <td style="font-family:monospace">${h(enabledStatusLabel(a?.enabled))}</td>
                <td style="font-family:monospace">${h(toFlag(a?.auto_provision_enabled))}</td>
                <td><input type="number" min="1" step="1" id="${h(rowId)}_max" value="${h(a?.max_devices)}" ${disabledAttr(canEdit)}></td>
                <td><input id="${h(rowId)}_sip_user" type="text" value="${h(a?.sip_username || '')}" ${disabledAttr(canEdit)}></td>
                <td><input id="${h(rowId)}_sip_domain" type="text" value="${h(a?.sip_domain || '')}" ${disabledAttr(canEdit)}></td>
                <td><input id="${h(rowId)}_ws" type="text" value="${h(a?.websocket_url || '')}" ${disabledAttr(canEdit)}></td>
                <td style="font-family:monospace">${h(c.total)}</td>
                <td style="font-family:monospace">${h(accountRevokedText)}</td>
                <td>
                  <div class="row-actions">
                    <label style="font-family:monospace;display:flex;align-items:center;gap:6px">
                      <input type="checkbox" id="${h(rowId)}_enabled" ${a?.enabled === true ? 'checked' : ''} ${disabledAttr(canEdit)}>
                      <span id="${h(rowId)}_enabled_lbl">${h(enabledText)}</span>
                    </label>
                    <label style="font-family:monospace;display:flex;align-items:center;gap:6px">
                      <input type="checkbox" id="${h(rowId)}_auto" ${a?.auto_provision_enabled === true ? 'checked' : ''} ${disabledAttr(canEdit)}>
                      auto
                    </label>
                    <button class="btn btn-secondary" type="button" id="${h(rowId)}_editbtn" onclick="editProvRow('${h(rowId)}')">Edit</button>
                    <button class="btn" type="button" id="${h(rowId)}_btn" onclick="saveProvRow('${h(pid)}','${h(rowId)}')" disabled>Save</button>
                    <button class="btn btn-secondary" type="button" id="${h(rowId)}_pinbtn" onclick="resetProvPin('${h(pid)}','${h(rowId)}')">Generate New PIN</button>
                    <button class="btn btn-danger" type="button" id="${h(rowId)}_delbtn" onclick="deleteProvAccount('${h(pid)}','${h(rowId)}')">Delete</button>
                  </div>
                  <div class="row-msg" id="${h(rowId)}_msg"></div>
                </td>
              </tr>`;
        })
        .join('');
}
function renderProvisionedDeviceRows(devRows) {
  return devRows.length === 0
    ? '<tr><td colspan="9" class="muted">No provisioned devices found.</td></tr>'
    : devRows
        .map((d) => {
          const rowId = deviceRowId(d);
          const pid = String(d?.provisioning_id || '');
          const did = String(d?.device_id || '');
          const revoked = d?.revoked === true;
          const btnClass = revoked ? 'btn btn-secondary' : 'btn btn-danger';
          const btnLabel = revoked ? 'Unrevoke' : 'Revoke';
          return `<tr>
                <td style="font-family:monospace">${h(pid)}</td>
                <td style="font-family:monospace">${h(did)}</td>
                <td style="font-family:monospace">${h(d?.device_name || '')}</td>
                <td style="font-family:monospace">${h(d?.platform || '')}</td>
                <td style="font-family:monospace">${h(d?.app_version || '')}</td>
                <td style="font-family:monospace">${h(d?.first_provisioned_at || '')}</td>
                <td style="font-family:monospace">${h(d?.last_provisioned_at || '')}</td>
                <td style="font-family:monospace">${h(toFlag(revoked))}</td>
                <td>
                  <div class="row-actions">
                    <button class="${btnClass}" type="button" id="${h(rowId)}_btn" onclick="toggleRevoke('${h(pid)}','${h(did)}','${h(rowId)}',${revoked ? 'false' : 'true'})">${btnLabel}</button>
                  </div>
                  <div class="row-msg" id="${h(rowId)}_msg"></div>
                </td>
              </tr>`;
        })
        .join('');
}
module.exports = {
  renderProvisioningAccountRows,
  renderProvisionedDeviceRows,
  CLIENT_SCRIPT,
};
