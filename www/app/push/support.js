import { logLine } from "../log.js";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    logLine("[Push] Service workers not supported");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    logLine("[Push] Service worker ready");
    return registration;
  } catch (error) {
    logLine("[Push] Service worker registration failed: " + error.message);
    return null;
  }
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  try {
    return await Notification.requestPermission();
  } catch {
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
