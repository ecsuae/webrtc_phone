export function desktopHeaderSection() {
  return `
    <div class="header">
      <div class="header-logo-wrap">
        <img src="/mobi-logo.svg?v=1772995480" alt="MOBI" class="header-logo" />
      </div>
    </div>
  `;
}

export function desktopStatusBarSection() {
  return `
    <div class="status-bar">
      <div class="status-item">
        <span class="status-indicator" id="statusIndicator"></span>
        <span id="status">Idle</span>
        <span id="activeProfileBadge" class="active-profile-badge" title="Active call profile (selected by the app)"><i class="fa-solid fa-wifi"></i></span>
      </div>
      <button class="refresh-btn" id="debugToggle" title="Toggle Debug Mode" onclick="toggleDebugModeUI()">
        <i class="fas fa-bug"></i>
      </button>
      <button class="refresh-btn" id="refreshBtn" title="Hard Reload & Clear All Cache" onclick="clearAllCacheAndReload()">
        <i class="fas fa-gear"></i>
      </button>
      <button class="refresh-btn" id="logOffBtn" style="display:none;" onclick="document.getElementById('btnStop').click();" title="Log Off">
        <i class="fas fa-power-off"></i>
      </button>
      <div class="status-item" id="domainDisplayContainer">
        <span id="domainDisplay">-</span>
      </div>
    </div>
  `;
}

export function desktopLogSection() {
  return `
    <audio id="remoteAudio" autoplay="true" playsinline="true"></audio>

    <div class="card log-container">
      <h3><i class="fas fa-terminal"></i> Debug Log</h3>
      <pre id="log"></pre>
      <button class="toggle-btn" onclick="document.getElementById('log').parentElement.classList.toggle('collapsed')">
        <i class="fas fa-chevron-up"></i> Collapse Log
      </button>
    </div>
  `;
}
