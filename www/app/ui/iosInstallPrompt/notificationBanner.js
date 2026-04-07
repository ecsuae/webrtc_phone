import { logLine } from "../log.js";

let notificationBanner = null;

export function showNotificationPromptBanner() {
  if (sessionStorage.getItem("notification-prompt-dismissed")) return;
  if (notificationBanner) return;

  const banner = document.createElement("div");
  banner.id = "notification-prompt-banner";
  banner.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: white;
    padding: 16px 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    animation: slideDown 0.3s ease-out;
  `;

  banner.innerHTML = `
    <div id="ios-install-content">
      <div id="ios-install-text">
        <strong>🔔 Enable Notifications</strong>
        <small>Allow notifications to receive incoming calls when the screen is locked</small>
      </div>
      <div>
        <button id="notification-enable-btn">Enable</button>
        <button class="close-btn" id="notification-dismiss">Later</button>
      </div>
    </div>
  `;

  document.body.appendChild(banner);
  notificationBanner = banner;

  document.body.style.paddingTop = `${banner.offsetHeight}px`;

  banner.querySelector("#notification-enable-btn").addEventListener("click", async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        logLine("[iOS] Notification permission granted");
        dismissNotificationBanner();
        showSuccessBanner("✅ Notifications enabled! You'll now receive incoming calls.");
      } else {
        showErrorBanner("⚠️ Notification permission denied. You can enable it in Settings > Safari > Notifications");
      }
    } catch (err) {
      logLine("[iOS] Notification permission error: " + err.message);
      showErrorBanner("⚠️ Could not request notifications. Please check Settings.");
    }
  });

  banner.querySelector("#notification-dismiss").addEventListener("click", () => {
    dismissNotificationBanner();
  });

  logLine("[iOS] Notification prompt banner shown");
}

export function dismissNotificationBanner() {
  if (!notificationBanner) return;

  sessionStorage.setItem("notification-prompt-dismissed", "true");
  notificationBanner.style.animation = "slideUp 0.3s ease-out";

  setTimeout(() => {
    if (notificationBanner) {
      notificationBanner.remove();
      notificationBanner = null;
      document.body.style.paddingTop = "";
    }
  }, 300);
}

function showSuccessBanner(message) {
  showTemporaryBanner(message, "#10b981");
}

function showErrorBanner(message) {
  showTemporaryBanner(message, "#ef4444");
}

function showTemporaryBanner(message, bgColor) {
  const banner = document.createElement("div");
  banner.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${bgColor};
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10001;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 14px;
    max-width: 90%;
    animation: fadeIn 0.3s ease-out;
  `;

  banner.innerHTML = `
    <style>
      @keyframes fadeIn {
        from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        to { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    </style>
    ${message}
  `;

  document.body.appendChild(banner);

  setTimeout(() => {
    banner.style.animation = "fadeOut 0.3s ease-out";
    setTimeout(() => banner.remove(), 300);
  }, 5000);
}
