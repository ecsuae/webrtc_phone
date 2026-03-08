// Load devices from API
async function loadDevices() {
  const listEl = document.getElementById('deviceList');
  console.log('📱 loadDevices() called');
  listEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading devices...</div>';

  try {
    const response = await fetch('/api/logs/mobile');
    const data = await response.json();
    console.log('✓ Devices loaded:', data.devices?.length || 0, 'devices');

    updateStats(data);
    renderDevices(data.devices);
  } catch (err) {
    listEl.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle"></i><p>Failed to load devices</p></div>`;
    console.error('❌ Failed to load devices:', err);
  }
}

// Update statistics
function updateStats(data) {
  const devices = data.devices || [];
  document.getElementById('totalDevices').textContent = devices.length;

  const debugActive = devices.filter(d => d.metadata?.debugMode).length;
  document.getElementById('debugActive').textContent = debugActive;

  const iosCount = devices.filter(d => d.metadata?.deviceType === 'iOS').length;
  document.getElementById('iosCount').textContent = iosCount;

  const androidCount = devices.filter(d => d.metadata?.deviceType === 'Android').length;
  document.getElementById('androidCount').textContent = androidCount;
}

// Render device list with deduplication by browser fingerprint
function renderDevices(devices) {
  const listEl = document.getElementById('deviceList');
  console.log('🎨 renderDevices() called with', devices?.length || 0, 'devices');

  if (!devices || devices.length === 0) {
    listEl.innerHTML = '<div class="empty"><i class="fas fa-mobile-alt"></i><p>No devices found</p></div>';
    return;
  }

  // Deduplicate: keep only the latest record per device per browser fingerprint
  const deduped = {};
  devices.forEach(device => {
    const deviceId = device.deviceId;
    const browserFingerprint = device.metadata?.browserFingerprint || 'unknown';
    const key = `${deviceId}:${browserFingerprint}`;
    
    if (!deduped[key] || new Date(device.metadata?.lastSeen) > new Date(deduped[key].metadata?.lastSeen)) {
      deduped[key] = device;
    }
  });

  const uniqueDevices = Object.values(deduped);
  const sortedDevices = uniqueDevices.sort((a, b) => {
    const aDebug = Boolean(a?.metadata?.debugMode);
    const bDebug = Boolean(b?.metadata?.debugMode);
    if (aDebug !== bDebug) return bDebug - aDebug;

    const aTs = a?.metadata?.lastSeen ? Date.parse(a.metadata.lastSeen) : 0;
    const bTs = b?.metadata?.lastSeen ? Date.parse(b.metadata.lastSeen) : 0;
    return bTs - aTs;
  });

  console.log('🔍 After dedup/sort:', sortedDevices.length, 'unique device entries');
  listEl.innerHTML = sortedDevices.map(device => renderDevice(device)).join('');
  console.log('✓ Rendered', sortedDevices.length, 'devices to DOM');
}

// Render individual device
function renderDevice(device) {
  const meta = device.metadata || {};
  const deviceType = meta.deviceType || 'unknown';
  const deviceModel = meta.deviceModel || 'unknown';
  const browserName = meta.browserName || 'unknown';
  const browserVersion = meta.browserVersion || 'unknown';
  const osName = meta.osName || 'unknown';
  const osVersion = meta.osVersion || 'unknown';
  const platform = meta.platform || 'unknown';
  const language = meta.language || 'unknown';
  const timeZone = meta.timeZone || 'unknown';
  const screenInfo = meta.screenInfo || 'unknown';
  const debugMode = meta.debugMode || false;
  const currentUsername = meta.currentUsername || 'not-logged-in';
  const usernameHistory = meta.usernameHistory || [];
  const comment = meta.comment || '';
  const lastSeenDate = meta.lastSeen ? new Date(meta.lastSeen) : null;
  const lastSeen = lastSeenDate ? lastSeenDate.toLocaleString() : 'Never';
  const ageMs = lastSeenDate ? (Date.now() - lastSeenDate.getTime()) : Number.POSITIVE_INFINITY;
  const isOnline = ageMs <= (30 * 60 * 1000);
  const seenMinutes = Number.isFinite(ageMs) ? Math.floor(ageMs / 60000) : null;
  const seenText = seenMinutes === null ? 'n/a' : `${seenMinutes} min ago`;
  const browserIdShort = meta.browserId ? String(meta.browserId).slice(-8) : 'n/a';
  const deviceFpShort = meta.deviceFingerprint ? String(meta.deviceFingerprint).slice(-12) : 'n/a';
  const browserFpShort = meta.browserFingerprint ? String(meta.browserFingerprint).slice(-12) : 'n/a';
  const hasLogs = device.logFileCount > 0;

  return `
    <div class="device-item">
      <div class="device-header">
        <div class="device-id">${device.deviceId}</div>
        <div class="device-badges">
          <span class="badge ${isOnline ? 'badge-online' : 'badge-offline'}">
            <i class="fas ${isOnline ? 'fa-circle-check' : 'fa-circle-minus'}"></i> ${isOnline ? 'Online' : 'Offline'}
          </span>
          ${deviceType === 'iOS' || osName === 'iOS' || osName === 'iPadOS' ? '<span class="badge badge-ios"><i class="fab fa-apple"></i> ' + osName + ' ' + osVersion + '</span>' : ''}
          ${deviceType === 'Android' || osName === 'Android' ? '<span class="badge badge-android"><i class="fab fa-android"></i> Android ' + osVersion + '</span>' : ''}
          ${(deviceType !== 'iOS' && deviceType !== 'Android' && osName !== 'iOS' && osName !== 'iPadOS' && osName !== 'Android' && osName !== 'unknown') ? '<span class="badge badge-android"><i class="fas fa-desktop"></i> ' + osName + ' ' + osVersion + '</span>' : ''}
          ${debugMode ? '<span class="badge badge-debug"><i class="fas fa-bug"></i> Debug Mode</span>' : ''}
        </div>
      </div>

      <div class="device-info">
        <div class="info-item">
          <div class="label">Device Model</div>
          <div class="value">${deviceModel}</div>
        </div>
        <div class="info-item">
          <div class="label">Browser</div>
          <div class="value">${browserName} ${browserVersion}</div>
        </div>
        <div class="info-item">
          <div class="label">Browser ID</div>
          <div class="value">...${browserIdShort}</div>
        </div>
        <div class="info-item">
          <div class="label">Device FP</div>
          <div class="value">...${deviceFpShort}</div>
        </div>
        <div class="info-item">
          <div class="label">Browser FP</div>
          <div class="value">...${browserFpShort}</div>
        </div>
        <div class="info-item">
          <div class="label">Platform</div>
          <div class="value">${platform}</div>
        </div>
        <div class="info-item">
          <div class="label">Screen</div>
          <div class="value">${screenInfo}</div>
        </div>
        <div class="info-item">
          <div class="label">Locale / TZ</div>
          <div class="value">${language} / ${timeZone}</div>
        </div>
        <div class="info-item">
          <div class="label">Current Username</div>
          <div class="value">${currentUsername}</div>
        </div>
        <div class="info-item">
          <div class="label">Last Seen</div>
          <div class="value">${lastSeen}</div>
        </div>
        <div class="info-item">
          <div class="label">Seen Age</div>
          <div class="value">${seenText}</div>
        </div>
        <div class="info-item">
          <div class="label">Log Files</div>
          <div class="value">${device.logFileCount} files</div>
        </div>
        <div class="info-item">
          <div class="label">Update Count</div>
          <div class="value">${meta.updateCount || 0}</div>
        </div>
      </div>

      ${usernameHistory.length > 0 ? `
        <div class="info-item">
          <div class="label">Username History</div>
          <div class="username-list">
            ${usernameHistory.map(u => `<span class="username-tag">${u}</span>`).join('')}
          </div>
        </div>
      ` : ''}

      ${comment ? `
        <div class="comment-section">
          <div class="comment-display">
            <strong>Comment:</strong> ${escapeHtml(comment)}
          </div>
        </div>
      ` : ''}

      <div class="comment-section">
        <div class="comment-form">
          <input 
            type="text" 
            class="comment-input" 
            placeholder="Add a comment to identify this device..." 
            value="${escapeHtml(comment)}"
            id="comment-${device.deviceId}"
          />
          <button class="comment-btn" onclick="updateComment('${device.deviceId}')">
            <i class="fas fa-save"></i> Save
          </button>
        </div>
      </div>

      <div style="display: flex; gap: 10px; margin-top: 12px;">
        <button 
          class="view-logs-btn" 
          ${!hasLogs ? 'disabled' : ''}
          onclick="viewLogs('${device.deviceId}')"
        >
          <i class="fas fa-file-alt"></i> View Logs (${device.logFileCount})
        </button>
        <button 
          class="delete-btn" 
          onclick="deleteDevice('${device.deviceId}')"
          title="Delete this device and its logs"
        >
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `;
}

// Update comment for a device
async function updateComment(deviceId) {
  const input = document.getElementById(`comment-${deviceId}`);
  const comment = input.value.trim();

  try {
    const response = await fetch(`/api/logs/mobile/${deviceId}/comment`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment })
    });

    if (response.ok) {
      alert('Comment saved successfully!');
      loadDevices(); // Reload to show updated comment
    } else {
      alert('Failed to save comment');
    }
  } catch (err) {
    alert('Error saving comment: ' + err.message);
  }
}

// View logs for a device
function viewLogs(deviceId) {
  window.open(`/api/logs/mobile/${deviceId}`, '_blank');
}

// Delete a device and its logs
async function deleteDevice(deviceId) {
  console.log('🗑️  deleteDevice() called for:', deviceId);
  
  if (!confirm(`Are you sure you want to delete device ${deviceId} and all its logs?`)) {
    console.log('❌ Delete cancelled by user');
    return;
  }

  try {
    console.log('📤 Sending DELETE request for:', deviceId);
    const response = await fetch(`/api/logs/mobile/${deviceId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      console.log('✓ Device deleted successfully:', deviceId);
      alert('Device deleted successfully!');
      loadDevices(); // Reload to reflect deletion
    } else {
      console.error('❌ Delete failed with status:', response.status);
      alert('Failed to delete device');
    }
  } catch (err) {
    console.error('❌ Error deleting device:', err);
    alert('Error deleting device: ' + err.message);
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initial load on page ready (no auto-refresh)
console.log('🚀 Dashboard.js script loaded');

if (document.readyState === 'loading') {
  console.log('⏳ Page still loading, waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✓ DOMContentLoaded event fired, loading devices...');
    loadDevices();
  });
} else {
  console.log('✓ Page already loaded, loading devices immediately...');
  loadDevices();
}

// Keep online/offline badges fresh for active devices.
setInterval(() => {
  loadDevices();
}, 30000);
