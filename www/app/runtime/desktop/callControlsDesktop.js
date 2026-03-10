export function setupDesktopCallControls() {
  // No-op for desktop bootstrap.
  // setupTabNavigation() and setupCallControls() are already initialized by bindControlHandlers()
  // inside runtime/controlBindings.js. Calling them twice can desync UI behavior.
}
