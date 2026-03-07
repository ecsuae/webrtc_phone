// Load devices from API
async function loadDevices() {
  const listEl = document.getElementById('deviceList');
  listEl.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading devices...</div>';

  try {
    const response = await fetch('/api/logs/mobile');
    const data = await response.json();

    updateStats(data);
    renderDevices(data.devices);
  } catch (err) {
    listEl.innerHTML = `<div class="empty"><i class="fas fa-exclamation-triangle"></i><p>Failed to load devices</p></div>`;
    console.error('Failed to load devices:', err);
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

// Render device list
function renderDevices(devices) {
  const listEl = document.getElementById('deviceList');

  if (!devices || devices.length === 0) {
    listEl.innerHTML = '<div class="empty"><i class="fas fa-mobile-alt"></i><p>No devices found</p></div>';
    return;
  }

  listEl.innerHTML = devices.map(device => renderDevice(device)).join('');
}

// Render individual device
function renderDevice(device) {
  const meta = device.metadata || {};
  const deviceType = meta.deviceType || 'unknown';
  const debugMode = meta.debugMode || false;
  const currentUsername = meta.currentUsername || 'not-logged-in';
  const usernameHistory = meta.usernameHistory || [];
  const comment = meta.comment || '';
  const lastSeen = meta.lastSeen ? new Date(meta.lastSeen).toLocaleString() : 'Never';
  const hasLogs = device.logFileCount > 0;

  return `
    <div class="device-item">
      <div class="device-header">
        <div class="device-id">${device.deviceId}</div>
        <div class="device-badges">
          ${deviceType === 'iOS' ? '<span class="badge badge-ios"><i class="fab fa-apple"></i> iOS</span>' : ''}
          ${deviceType === 'Android' ? '<span class="badge badge-android"><i class="fab fa-android"></i> Android</span>' : ''}
          ${debugMode ? '<span class="badge badge-debug"><i class="fas fa-bug"></i> Debug Mode</span>' : ''}
        </div>
      </div>

      <div class="device-info">
        <div class="info-item">
          <div class="label">Current Username</div>
          <div class="value">${currentUsername}</div>
        </div>
        <div class="info-item">
          <div class="label">Last Seen</div>
          <div class="value">${lastSeen}</div>
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

      <button 
        class="view-logs-btn" 
        ${!hasLogs ? 'disabled' : ''}
        onclick="viewLogs('${device.deviceId}')"
      >
        <i class="fas fa-file-alt"></i> View Logs (${device.logFileCount})
      </button>
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Auto-refresh every 30 seconds
setInterval(loadDevices, 30000);

// Initial load on page ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadDevices);
} else {
  loadDevices();
}
