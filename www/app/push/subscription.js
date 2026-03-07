import { logLine } from "../log.js";
import { VAPID_PUBLIC_KEY, urlBase64ToUint8Array } from "./constants.js";
import { isPushSupported, requestNotificationPermission } from "./support.js";

let pushSubscription = null;
let pushEnabled = false;

async function sendSubscriptionToServer(subscription, extension) {
  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extension, subscription: subscription.toJSON() }),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
  return response.json();
}

async function removeSubscriptionFromServer(subscription, extension) {
  const response = await fetch("/api/push/unsubscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ extension, endpoint: subscription.endpoint }),
  });
  if (!response.ok) throw new Error(`Server returned ${response.status}`);
}

export async function subscribeToPush(extension) {
  if (!isPushSupported()) return null;
  if (!VAPID_PUBLIC_KEY || VAPID_PUBLIC_KEY === "YOUR_VAPID_PUBLIC_KEY_HERE") return null;

  const permission = await requestNotificationPermission();
  if (permission !== "granted") return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    pushSubscription = subscription;
    pushEnabled = true;
    await sendSubscriptionToServer(subscription, extension);
    logLine("[Push] Subscription registered with server");
    return subscription;
  } catch (error) {
    logLine("[Push] Subscription failed: " + error.message);
    return null;
  }
}

export async function unsubscribeFromPush(extension) {
  if (!pushSubscription) return;
  try {
    await removeSubscriptionFromServer(pushSubscription, extension);
    await pushSubscription.unsubscribe();
  } catch {}
  pushSubscription = null;
  pushEnabled = false;
}

export async function subscribeAfterRegister(extension) {
  if (!extension) return false;
  
  // On iOS, retry push subscription multiple times for reliability
  let attempts = 3;
  let result = false;
  
  while (attempts > 0 && !result) {
    try {
      const permission = await requestNotificationPermission();
      if (permission === "granted") {
        result = await subscribeToPush(extension);
        if (result) {
          logLine(`[Push] Successfully subscribed after register for ${extension}`);
          return true;
        }
      }
    } catch (err) {
      console.warn(`[Push] Subscribe attempt ${4 - attempts} failed:`, err);
    }
    
    if (!result && attempts > 1) {
      // Wait a short time before retrying
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    attempts--;
  }
  
  return result;
}

export function getPushStatus() {
  return {
    supported: isPushSupported(),
    enabled: pushEnabled,
    permission: "Notification" in window ? Notification.permission : "unsupported",
    subscription: pushSubscription,
  };
}
