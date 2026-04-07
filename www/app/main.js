import { setRuntimeEnv } from "./runtime/shared/runtimeEnv.js";

function computeRuntimeEnv() {
  const ua = navigator.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isChromeIOS = /CriOS/i.test(ua);
  return { userAgent: ua, isAndroid, isIOS, isChromeIOS };
}

setRuntimeEnv(computeRuntimeEnv());

function isAndroidClient() {
  return computeRuntimeEnv().isAndroid;
}

function isIosClient() {
  return computeRuntimeEnv().isIOS;
}

const cb = (() => {
  try {
    return String(window.__BUILD_CB || "");
  } catch {
    return "";
  }
})();

function withCb(url) {
  return cb ? `${url}?cb=${encodeURIComponent(cb)}` : url;
}

if (isAndroidClient()) {
  import(withCb("./runtime/android/bootstrapAndroid.js"))
    .then((m) => m.bootstrapAndroidApp(window.SIP))
    .catch((err) => console.error("[boot] Failed to load Android bootstrap:", err));
} else if (isIosClient()) {
  import(withCb("./runtime/ios/bootstrapIos.js"))
    .then((m) => m.bootstrapIosApp(window.SIP))
    .catch((err) => console.error("[boot] Failed to load iOS bootstrap:", err));
} else {
  import(withCb("./runtime/desktop/bootstrapDesktop.js"))
    .then((m) => m.bootstrapDesktopApp(window.SIP))
    .catch((err) => console.error("[boot] Failed to load Desktop bootstrap:", err));
}
