export function registrationSection() {
  return `
    <div class="card" id="registrationCard">
      <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; text-align: center;">
        <i class="fas fa-user-circle"></i> Account
      </h3>

      <div class="row" style="margin-bottom: 12px; display:none;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Domain</label>
          <input id="domain" value="testfusn.srve.cc" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>WSS Host</label>
          <input id="wsshost" value="phone.srve.cc" />
        </div>
      </div>

      <div class="row-center" id="accountFields" style="margin-bottom: 16px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label>Username</label>
          <input id="ext" name="ext" autocomplete="username" placeholder="e.g. 100360" />
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label>Password</label>
          <input id="pass" name="pass" type="password" autocomplete="current-password" placeholder="********" />
        </div>
      </div>

      <div class="row-center">
        <button id="btnStart" type="button" class="btn-primary">
          <i class="fas fa-sign-in-alt"></i> Log In
        </button>
        <button id="btnStop" type="button" class="btn-secondary">
          <i class="fas fa-power-off"></i> Log Off
        </button>
      </div>
    </div>
  `;
}
