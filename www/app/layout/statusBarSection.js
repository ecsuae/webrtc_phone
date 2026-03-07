export function statusBarSection() {
  return `
    <div class="status-bar">
      <div class="status-item">
        <span class="status-indicator" id="statusIndicator"></span>
        <span id="status">Idle</span>
      </div>
      <button class="refresh-btn" id="debugToggle" title="Toggle Debug Mode" onclick="toggleDebugModeUI()">
        <i class="fas fa-bug"></i>
      </button>
      <button class="refresh-btn" id="refreshBtn" title="Hard Reload & Clear All Cache" onclick="clearAllCacheAndReload()">
        <i class="fas fa-redo-alt"></i>
      </button>
      <button class="refresh-btn" id="logOffBtn" style="display:none;" onclick="document.getElementById('btnStop').click();" title="Log Off">
        <i class="fas fa-power-off"></i>
      </button>
      <div class="status-item">
        <i class="fas fa-signal"></i>
        <span id="tstatus">Disconnected</span>
      </div>
    </div>
  `;
}
