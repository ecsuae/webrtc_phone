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

      <div class="row-center" style="margin-bottom: 16px;">
        <div class="form-group" style="margin-bottom: 0; width: 100%; max-width: 420px;">
          <label for="provisioningId">Autoconfigure ID</label>
          <div class="auto-config-row" style="display:flex; gap:10px; align-items: stretch; width:100%;">
            <div style="flex:1; min-width:0;">
              <input id="provisioningId" name="provisioningId" class="auto-config-input" type="text" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="e.g. 78653467" style="width: 100%; padding: 12px 16px; border: 2px solid var(--border-color); border-radius: 10px; font-size: 15px; background: #fff; box-sizing: border-box;" />
            </div>
            <button id="btnAutoProvisionStart" type="button" class="btn-outline auto-config-button" title="Configure with ID" disabled style="width:58px; min-width:58px; flex:0 0 58px; padding: 0; display:inline-flex; align-items:center; justify-content:center; font-size:18px;">
              ➜
            </button>
          </div>
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

      <div id="autoProvisionModal" style="display:none; position: fixed; inset: 0; background: rgba(2, 6, 23, 0.6); z-index: 50;">
        <div class="card" style="max-width: 420px; margin: 12vh auto 0 auto; padding: 16px;">
          <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; text-align: center;">
            <i class="fas fa-key"></i> Enter PIN
          </h3>
          <div class="row-center" style="margin-bottom: 12px;">
            <div class="form-group" style="margin-bottom: 0; width: 100%;">
              <label>PIN</label>
              <input id="provisioningPin" name="provisioningPin" type="password" autocomplete="off" placeholder="Enter 4-digit PIN" />
            </div>
          </div>
          <div class="row-center" style="margin-bottom: 12px;">
            <label class="save-provisioning-row" style="display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;">
              <input id="chkSaveProvisioningCreds" type="checkbox" style="display:inline-block; width:16px; height:16px; margin:0; padding:0; appearance:auto;" />
              <span>Save ID &amp; PIN</span>
            </label>
          </div>
          <div class="row-center" style="margin-bottom: 12px;">
            <button id="btnForgetProvisioningCreds" type="button" class="btn-outline" style="display:none; width:auto; padding: 6px 10px; font-size: 12px; font-weight: 600;">Forget saved ID &amp; PIN</button>
          </div>
          <div id="autoProvisionStatus" style="display:none; margin: 0 0 12px 0;"></div>
          <div class="row-center">
            <button id="btnAutoProvisionConfigure" type="button" class="btn-primary">
              <i class="fas fa-sign-in-alt"></i> Login
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
