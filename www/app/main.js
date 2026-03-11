import { bootstrapDesktopApp } from "./runtime/desktop/bootstrapDesktop.js?v=1773032001";
import { bootstrapAndroidApp } from "./runtime/android/bootstrapAndroid.js?v=1773032001";
import { bootstrapIosApp } from "./runtime/ios/bootstrapIos.js?v=1773032001";

function isAndroidClient() {
  return /Android/i.test(navigator.userAgent || "");
}

function isIosClient() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}

if (isAndroidClient()) {
  bootstrapAndroidApp(window.SIP);
} else if (isIosClient()) {
  bootstrapIosApp(window.SIP);
} else {
  bootstrapDesktopApp(window.SIP);
}
