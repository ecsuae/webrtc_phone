import { logLine } from "../log.js";

let installBanner = null;

export function showIOSInstallBanner() {
  if (sessionStorage.getItem("ios-install-dismissed")) return;
  if (installBanner) return;

  const banner = document.createElement("div");
  banner.id = "ios-install-banner";
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: slideDown 0.3s ease-out;
  `;

  banner.innerHTML = `
    <style>
      @keyframes slideDown {
        from { transform: translateY(-100%); }
        to { transform: translateY(0); }
      }
      #ios-install-banner button {
        background: white;
        color: #667eea;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 600;
        font-size: 14px;
        cursor: pointer;
        margin-left: 12px;
      }
      #ios-install-banner .close-btn {
        background: rgba(255,255,255,0.2);
        color: white;
        padding: 6px 12px;
        font-size: 12px;
      }
      #ios-install-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      #ios-install-text {
        flex: 1;
      }
      #ios-install-text strong {
        display: block;
        font-size: 16px;
        margin-bottom: 4px;
      }
      #ios-install-text small {
        opacity: 0.9;
        font-size: 13px;
      }
      .share-icon {
        display: inline-block;
        width: 18px;
        height: 22px;
        margin: 0 4px;
        vertical-align: middle;
      }
    </style>
    <div id="ios-install-content">
      <div id="ios-install-text">
        <strong>📱 Install App for Incoming Calls</strong>
        <small>Tap <svg class="share-icon" viewBox="0 0 50 50" fill="white"><path d="M25 2L25 34M25 2L15 12M25 2L35 12M10 18v24h30V18"/></svg> Share → "Add to Home Screen" to receive calls when screen is locked</small>
      </div>
      <button class="close-btn" id="ios-install-dismiss">Got it</button>
    </div>
  `;

  document.body.appendChild(banner);
  installBanner = banner;

  document.body.style.paddingTop = `${banner.offsetHeight}px`;

  banner.querySelector("#ios-install-dismiss").addEventListener("click", () => {
    dismissIOSInstallBanner();
  });

  logLine("[iOS] Install banner shown");
}

export function dismissIOSInstallBanner() {
  if (!installBanner) return;

  sessionStorage.setItem("ios-install-dismissed", "true");
  installBanner.style.animation = "slideUp 0.3s ease-out";

  setTimeout(() => {
    if (installBanner) {
      installBanner.remove();
      installBanner = null;
      document.body.style.paddingTop = "";
    }
  }, 300);
}

export function hasInstallBanner() {
  return !!installBanner;
}
