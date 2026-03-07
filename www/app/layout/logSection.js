export function logSection() {
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
