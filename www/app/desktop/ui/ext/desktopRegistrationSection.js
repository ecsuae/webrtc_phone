export function desktopRegistrationSection() {
  const conferenceEnabled = String(document?.body?.dataset?.conferenceEnabled || "").toLowerCase() === "true";
  const sipDomain = String(document?.body?.dataset?.sipDomain || "");
  const wssHost = String(document?.body?.dataset?.wssHost || "");

  return `
    <div class="card" id="registrationCard">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; text-align: center;">
        <i class="fas fa-user-circle"></i> Account
      </h3>

      <div class="row" style="margin-bottom: 12px; display:none;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Domain</label>
          <input id="domain" value="${sipDomain}" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>WSS Host</label>
          <input id="wsshost" value="${wssHost}" />
        </div>
      </div>

      <div class="row-center" id="accountFields" style="margin-bottom: 16px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Username</label>
          <input id="ext" name="ext" autocomplete="username" placeholder="e.g. 100360" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>Password</label>
          <div class="password-field">
            <input id="pass" name="pass" type="password" autocomplete="current-password" placeholder="********" />
            <button id="btnPassToggle" type="button" class="pass-toggle-btn" aria-label="Show password">
              <i class="fas fa-eye"></i>
            </button>
          </div>
        </div>
      </div>

      <div class="row-center" style="margin-bottom: 12px;">
        <button id="btnAutoProvisionOpen" type="button" class="btn-outline" title="Auto Provision">
          <i class="fas fa-magic"></i> Auto Provision
        </button>
      </div>

      <div id="autoProvisionModal" style="display:none;">
        <div class="card" style="margin-top: 12px;">
          <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; text-align: center;">
            <i class="fas fa-magic"></i> Auto Provision
          </h3>

          <div class="row-center" style="margin-bottom: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Provisioning ID</label>
              <input id="provisioningId" name="provisioningId" autocomplete="off" placeholder="Enter Provisioning ID" />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>PIN</label>
              <input id="provisioningPin" name="provisioningPin" type="password" autocomplete="off" placeholder="Enter PIN" />
            </div>
          </div>

          <div class="row-center" style="margin-bottom: 12px;">
            <label style="display:flex; align-items:center; gap:8px;">
              <input id="chkSaveProvisioningCreds" type="checkbox" />
              Save Provisioning ID and PIN on this device
            </label>
          </div>

          <div id="autoProvisionStatus" style="display:none; margin: 0 0 12px 0;"></div>

          <div class="row-center">
            <button id="btnAutoProvisionConfigure" type="button" class="btn-primary">
              <i class="fas fa-check"></i> Configure
            </button>
            <button id="btnAutoProvisionCancel" type="button" class="btn-secondary">
              <i class="fas fa-times"></i> Cancel
            </button>
          </div>
        </div>
      </div>

      <div class="row-center">
        <button id="btnStart" type="button" class="btn-primary">
          <i class="fas fa-bolt"></i> Enable Calls
        </button>
        <button id="btnStop" type="button" class="btn-secondary">
          <i class="fas fa-power-off"></i> Log Off
        </button>
      </div>

      <div style="margin-top: 12px; text-align: center;">
        <button id="btnMobileCompat" type="button" class="mobile-compat-btn" title="LTE/5G Compatibility Mode">
          <i class="fas fa-signal"></i> <span class="compat-label">LTE/5G Mode</span>
        </button>
      </div>

      <div id="regDiagWidget" style="display:none; margin-top:10px;"></div>

      ${
        conferenceEnabled
          ? `
      <div id="conferenceSection" style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(148, 163, 184, 0.35);">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; font-weight: 600; text-align: center;">
          <i class="fas fa-users"></i> Conference
        </h3>
        <div class="row-center" style="margin-bottom: 12px;">
          <div class="form-group" style="margin-bottom: 0;">
            <label>Conference PIN</label>
            <input id="conferencePin" name="conferencePin" inputmode="numeric" autocomplete="one-time-code" placeholder="Enter PIN" />
          </div>
        </div>
        <div class="row-center">
          <button id="btnJoinConference" type="button" class="btn-success">
            <i class="fas fa-users"></i> Join Conference
          </button>
        </div>
      </div>
      `
          : ""
      }
    </div>
  `;
}
