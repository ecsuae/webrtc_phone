import { logLine } from "../log.js";

/**
 * iOS Install Prompt
 * Detects iOS Safari and prompts user to install PWA for push notifications
 */

let installBanner = null;
let notificationBanner = null;

export function checkIOSInstallation() {
  const ua = navigator.userAgent || "";
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  
  if (!isIOS) return false;
  
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  const isChromeIOS = /CriOS/i.test(ua);
  
  // Not in standalone mode - show install prompt
  if (!isStandalone) {
    showIOSInstallBanner();
    return false;
  }
  
  // In standalone but notification permission not granted
  if ("Notification" in window && Notification.permission === "default") {
    showNotificationPromptBanner();
    return false;
  }
  
  return true;
}

function showIOSInstallBanner() {
  // Don't show if already dismissed in this session
  if (sessionStorage.getItem('ios-install-dismissed')) return;
  
  if (installBanner) return; // Already showing
  
  const banner = document.createElement('div');
  banner.id = 'ios-install-banner';
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
  
  // Adjust body padding to account for banner
  document.body.style.paddingTop = `${banner.offsetHeight}px`;
  
  // Close button handler
  banner.querySelector('#ios-install-dismiss').addEventListener('click', () => {
    dismissIOSInstallBanner();
  });
  
  logLine("[iOS] Install banner shown");
}

function dismissIOSInstallBanner() {
  if (!installBanner) return;
  
  sessionStorage.setItem('ios-install-dismissed', 'true');
  installBanner.style.animation = 'slideUp 0.3s ease-out';
  
  setTimeout(() => {
    if (installBanner) {
      installBanner.remove();
      installBanner = null;
      document.body.style.paddingTop = '';
    }
  }, 300);
}

function showNotificationPromptBanner() {
  // Don't show if already dismissed in this session
  if (sessionStorage.getItem('notification-prompt-dismissed')) return;
  
  if (notificationBanner) return; // Already showing
  
  const banner = document.createElement('div');
  banner.id = 'notification-prompt-banner';
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
  
  // Adjust body padding
  document.body.style.paddingTop = `${banner.offsetHeight}px`;
  
  // Enable button handler
  banner.querySelector('#notification-enable-btn').addEventListener('click', async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
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
  
  // Dismiss button handler
  banner.querySelector('#notification-dismiss').addEventListener('click', () => {
    dismissNotificationBanner();
  });
  
  logLine("[iOS] Notification prompt banner shown");
}

function dismissNotificationBanner() {
  if (!notificationBanner) return;
  
  sessionStorage.setItem('notification-prompt-dismissed', 'true');
  notificationBanner.style.animation = 'slideUp 0.3s ease-out';
  
  setTimeout(() => {
    if (notificationBanner) {
      notificationBanner.remove();
      notificationBanner = null;
      document.body.style.paddingTop = '';
    }
  }, 300);
}

function showSuccessBanner(message) {
  showTemporaryBanner(message, '#10b981');
}

function showErrorBanner(message) {
  showTemporaryBanner(message, '#ef4444');
}

function showTemporaryBanner(message, bgColor) {
  const banner = document.createElement('div');
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
    banner.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => banner.remove(), 300);
  }, 5000);
}

// Re-check when returning from background (user might have installed PWA)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Small delay to let the app settle
    setTimeout(() => {
      if (installBanner) {
        // Check if now in standalone mode
        const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
        if (isStandalone) {
          dismissIOSInstallBanner();
          // Now check notification permission
          if ("Notification" in window && Notification.permission === "default") {
            showNotificationPromptBanner();
          }
        }
      }
    }, 1000);
  }
});

export function hideAllBanners() {
  dismissIOSInstallBanner();
  dismissNotificationBanner();
}
