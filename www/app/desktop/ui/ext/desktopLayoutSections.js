import { desktopRegistrationSection } from "./desktopRegistrationSection.js";

function desktopDialpadSection() {
  return `
    <div class="card" id="dialpadCard" style="display:none;">
      <div id="incomingAlertBanner" style="display:none; margin: 0 0 12px 0; padding: 12px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25);">
        <div id="incomingAlertTitle" style="font-weight: 700;"></div>
      </div>
      <div class="tabs">
        <button class="tab-btn active" data-tab="dial-tab"><i class="fas fa-phone-alt"></i> Dial</button>
        <button class="tab-btn" data-tab="history-tab"><i class="fas fa-history"></i> History</button>
      </div>

      <div class="tab-content active" id="dial-tab">
        <div id="callTimer" style="text-align: center; margin-bottom: 4px; display: none;">
          <div style="font-size: 20px; font-weight: 700; color: var(--success-color); font-family: monospace;">
            <span id="timerDisplay">00:00:00</span>
          </div>
        </div>

        <div id="rtpIndicators" class="rtpIndicators" style="display: none;">
          <div class="rtpIndicatorRow">
            <div class="rtpIndicatorLabel">RX</div>
            <div class="rtpBar"><div id="rtpRxBar" class="rtpBarFill rtpBarFillRx" style="width: 0%;"></div></div>
            <div id="rtpRxText" class="rtpIndicatorValue">0 pkt/s</div>
          </div>
          <div class="rtpIndicatorRow">
            <div class="rtpIndicatorLabel">TX</div>
            <div class="rtpBar"><div id="rtpTxBar" class="rtpBarFill rtpBarFillTx" style="width: 0%;"></div></div>
            <div id="rtpTxText" class="rtpIndicatorValue">0 pkt/s</div>
          </div>
        </div>

        <div class="dial-display">
          <button id="btnDialErase" type="button" class="dial-erase-btn" title="Erase last digit" style="display:none;">
            <i class="fas fa-delete-left"></i>
          </button>
          <input id="dial" type="tel" placeholder="" readonly />
        </div>

        <div class="dial-buttons">
          <button class="dial-btn" data-digit="1">1 <span>&nbsp;</span></button>
          <button class="dial-btn" data-digit="2">2 <span>ABC</span></button>
          <button class="dial-btn" data-digit="3">3 <span>DEF</span></button>
          <button class="dial-btn" data-digit="4">4 <span>GHI</span></button>
          <button class="dial-btn" data-digit="5">5 <span>JKL</span></button>
          <button class="dial-btn" data-digit="6">6 <span>MNO</span></button>
          <button class="dial-btn" data-digit="7">7 <span>PQRS</span></button>
          <button class="dial-btn" data-digit="8">8 <span>TUV</span></button>
          <button class="dial-btn" data-digit="9">9 <span>WXYZ</span></button>
          <button class="dial-btn dial-btn-special" data-digit="*">*</button>
          <button class="dial-btn" data-digit="0">0 <span>+</span></button>
          <button class="dial-btn dial-btn-special" data-digit="#">#</button>
        </div>

        <div class="call-controls" id="callControls" style="display: none;">
          <button id="btnMute" type="button" class="btn-outline"><i class="fas fa-microphone"></i> Mute</button>
          <button id="btnSpeaker" type="button" class="btn-outline"><i class="fas fa-volume-down"></i> Earpiece</button>
          <button id="btnHold" type="button" class="btn-outline"><i class="fas fa-pause"></i> Hold</button>
          <button id="btnAddCall" type="button" class="btn-outline"><i class="fas fa-user-plus"></i> Add Call</button>
          <button id="btnKeypad" type="button" class="btn-outline"><i class="fas fa-th"></i> Keypad</button>
          <button id="btnSwap" type="button" class="btn-outline" style="display: none;"><i class="fas fa-exchange-alt"></i> Swap</button>
          <button id="btnTransfer" type="button" class="btn-outline"><i class="fas fa-phone-volume"></i> Transfer</button>
          <button id="btnConference" type="button" class="btn-outline" style="display: none;"><i class="fas fa-users"></i> Conference</button>
          <button id="btnRecord" type="button" class="btn-outline"><i class="fas fa-circle"></i> Record</button>
        </div>

        <div class="dtmf-overlay" id="dtmfOverlay" style="display:none;">
          <div class="dtmf-overlay-content">
            <div class="dtmf-overlay-header">
              <div class="dtmf-overlay-title">Keypad</div>
              <button id="btnDtmfClose" type="button" class="btn-outline dtmf-close-btn"><i class="fas fa-times"></i></button>
            </div>
            <div class="dtmf-buttons">
              <button class="dtmf-btn" data-digit="1">1</button>
              <button class="dtmf-btn" data-digit="2">2</button>
              <button class="dtmf-btn" data-digit="3">3</button>
              <button class="dtmf-btn" data-digit="4">4</button>
              <button class="dtmf-btn" data-digit="5">5</button>
              <button class="dtmf-btn" data-digit="6">6</button>
              <button class="dtmf-btn" data-digit="7">7</button>
              <button class="dtmf-btn" data-digit="8">8</button>
              <button class="dtmf-btn" data-digit="9">9</button>
              <button class="dtmf-btn" data-digit="*">*</button>
              <button class="dtmf-btn" data-digit="0">0</button>
              <button class="dtmf-btn" data-digit="#">#</button>
            </div>
          </div>
        </div>

        <div class="call-actions">
          <button id="btnCall" type="button" class="call-btn call-btn-primary"><i class="fas fa-phone"></i><span>Call</span></button>
          <button id="btnHangup" type="button" class="call-btn call-btn-danger" style="display: none;"><i class="fas fa-phone-slash"></i><span>End</span></button>
          <button id="btnAnswer" type="button" class="call-btn call-btn-primary" style="display: none;"><i class="fas fa-phone"></i><span>Answer</span></button>
          <button id="btnReject" type="button" class="call-btn call-btn-danger" style="display: none;"><i class="fas fa-phone-slash"></i><span>Reject</span></button>
        </div>
      </div>

      <div class="tab-content" id="history-tab">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;"><i class="fas fa-history"></i> Call History</h3>
        <ul class="history-list" id="historyList">
          <li style="text-align: center; padding: 32px 16px; color: #94a3b8;">
            <i class="fas fa-phone-slash" style="font-size: 32px; display: block; margin-bottom: 8px; opacity: 0.5;"></i>
            No calls yet
          </li>
        </ul>
      </div>
    </div>
  `;
}

export function buildDesktopLayoutSections() {
  return {
    desktopRegistrationSection,
    desktopDialpadSection,
  };
}
