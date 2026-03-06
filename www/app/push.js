import { logLine } from "./log.js";
import {
  isPushSupported,
  registerServiceWorker,
  requestNotificationPermission,
  setupServiceWorkerListener,
  testPushNotification,
} from "./push/support.js";
import {
  subscribeToPush,
  unsubscribeFromPush,
  subscribeAfterRegister,
  getPushStatus,
} from "./push/subscription.js";

export {
  isPushSupported,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  setupServiceWorkerListener,
  getPushStatus,
  testPushNotification,
  subscribeAfterRegister,
};

export async function init() {
  if (!isPushSupported()) {
    logLine("[Push] Push notifications not supported in this browser");
    return false;
  }

  const registration = await registerServiceWorker();
  if (!registration) {
    logLine("[Push] Failed to initialize");
    return false;
  }

  logLine("[Push] Push notification system initialized");
  return true;
}
