let _desktopAdapter = null;

function setGlobalAdapter(adapter) {
  try {
    globalThis.__DESKTOP_PLATFORM_ADAPTER__ = adapter || null;
  } catch {}
}

function getGlobalAdapter() {
  try {
    return globalThis.__DESKTOP_PLATFORM_ADAPTER__ || null;
  } catch {
    return null;
  }
}

export function setDesktopPlatformAdapter(adapter) {
  _desktopAdapter = adapter || null;
  setGlobalAdapter(_desktopAdapter);
}

export function getDesktopPlatformAdapter() {
  return _desktopAdapter || getGlobalAdapter();
}
