export const VAPID_PUBLIC_KEY = "BIIM6yQ1rQ6xjGbrqddWBczRJ6jEV9inqGb83Qy28Z5CnlFSsNTp0LqCQVZnFSlzQIW83WctYBCyaIKiRf_OU3w";

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
