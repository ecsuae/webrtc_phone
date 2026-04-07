import { logLine } from "../log.js";
import { getRuntimeEnv } from "../runtime/shared/runtimeEnv.js";

const SW_BUILD = "20260310-r2";

function shouldShowSessionPrompt(key) {
  try {
    const value = sessionStorage.getItem(key);
    if (value === "1") return false;
    sessionStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

export function isPushSupported() {
  const basicSupport = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!basicSupport) return false;

  const env = getRuntimeEnv();
  const isIOS = !!env?.isIOS;
  if (!isIOS) return true;

  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  const isChromeIOS = !!env?.isChromeIOS;

  if (!isStandalone) return false;
  if (isChromeIOS) return false;

  return true;
}

export function inspectPushEnvironment() {
  const env = getRuntimeEnv();
  const isIOS = !!env?.isIOS;
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || navigator.standalone === true;
  const isChromeIOS = !!env?.isChromeIOS;
  const hasNotificationApi = "Notification" in window;
  const permission = hasNotificationApi ? Notification.permission : "denied";

  return {
    isIOS,
    isStandalone,
    isChromeIOS,
    hasNotificationApi,
    permission,
  };
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    logLine("[Push] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register(`/sw.js?v=${SW_BUILD}`);
    registration.update().catch(() => {});
    await navigator.serviceWorker.ready;
    logLine("[Push] Service worker ready");
    return registration;
  } catch (error) {
    logLine("[Push] Service worker registration failed: " + error.message);
    return null;
  }
}

export async function requestNotificationPermission() {
  const env = inspectPushEnvironment();
  const { isIOS, isStandalone, isChromeIOS } = env;

  if (isIOS && !isStandalone) {
    const message = "📱 To enable notifications: Tap Share → Add to Home Screen, then open app from home screen icon";
    logLine(`[Push] ${message}`);
    if (shouldShowSessionPrompt("push-ios-install-guidance-shown") && window.confirm(message + "\n\nShow instructions?")) {
      alert("Step 1: Tap the Share button (square with arrow) at the bottom of Safari\n\nStep 2: Scroll down and tap 'Add to Home Screen'\n\nStep 3: Tap 'Add'\n\nStep 4: Open the app from your home screen icon\n\nStep 5: Allow notifications when prompted");
    }
    return "denied";
  }

  if (isChromeIOS) {
    logLine("[Push] Chrome on iOS does not reliably support Web Push. Use Safari Home Screen app.");
    if (shouldShowSessionPrompt("push-ios-chrome-guidance-shown")) {
      alert("⚠️ Chrome on iOS doesn't support push notifications.\n\nPlease open this app in Safari and add it to your Home Screen for full functionality.");
    }
    return "denied";
  }

  if (!("Notification" in window)) {
    logLine("[Push] Notifications not supported in this browser");
    return "denied";
  }

  if (Notification.permission === "granted") {
    logLine("[Push] Notification permission already granted");
    return "granted";
  }

  if (Notification.permission === "denied") {
    logLine("[Push] Notification permission previously denied");
    if (shouldShowSessionPrompt("push-permission-denied-guidance-shown")) {
      if (isIOS) {
        alert(`⚠️ Notification permission denied.\n\nTo enable: Go to iPhone Settings → Safari → ${window.location.host} → Allow Notifications`);
      } else {
        alert("⚠️ Notification permission denied.\n\nTo enable: Click the lock/info icon in the address bar → Notifications → Allow");
      }
    }
    return "denied";
  }

  try {
    logLine("[Push] Requesting notification permission...");
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      logLine("[Push] ✅ Notification permission granted!");
    } else if (permission === "denied") {
      logLine("[Push] ❌ Notification permission denied by user");
    }

    return permission;
  } catch (err) {
    logLine("[Push] Error requesting permission: " + err.message);
    return "denied";
  }
}

export function setupServiceWorkerListener(onIncomingCall) {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type !== "incoming-call-action") return;
    const { action, callId, from } = event.data;
    if (!onIncomingCall) return;
    onIncomingCall({ action, from, callId });
  });
}

export async function testPushNotification() {
  const permission = await requestNotificationPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  registration.showNotification("Test Notification", {
    body: "This is a test notification from WebPhone",
    icon: "/icon-192.png",
    badge: "/badge-72.png",
    tag: "test",
    requireInteraction: false,
  });

  return true;
}
