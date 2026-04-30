let _adapter = null;

export function setPlatformAdapter(adapter) {
  _adapter = adapter || null;
}

export function getPlatformAdapter() {
  return _adapter;
}

export function requirePlatformAdapter() {
  if (_adapter) return _adapter;
  throw new Error("Platform adapter not set");
}
