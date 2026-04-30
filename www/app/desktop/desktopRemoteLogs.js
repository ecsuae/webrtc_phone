import {
  startRemoteLogging as startRemoteLoggingImpl,
  setUsername,
  toggleDebugMode,
  isDebugMode,
  captureLog,
  sendLogsToServer,
  sendMetadataToServer,
  getLogBuffer,
  getInfo,
} from "../remoteLogs.js?v=20260310-r1";

export function startDesktopRemoteLogging() {
  try {
    startRemoteLoggingImpl();
  } catch (err) {
    console.error("[DesktopRemoteLogs] Failed to start remote logging:", err);
  }
}

export function setDesktopUsername(username) {
  try {
    setUsername(username);
  } catch (err) {
    console.error("[DesktopRemoteLogs] Failed to set username:", err);
  }
}

export function toggleDesktopDebugMode() {
  try {
    return toggleDebugMode();
  } catch (err) {
    console.error("[DesktopRemoteLogs] Failed to toggle debug mode:", err);
    return false;
  }
}

export function isDesktopDebugMode() {
  try {
    return isDebugMode();
  } catch {
    return false;
  }
}

export function captureDesktopLog(level, message) {
  try {
    captureLog(level, message);
  } catch {}
}

export function sendDesktopLogsToServer() {
  try {
    return sendLogsToServer();
  } catch {}
}

export function sendDesktopMetadataToServer() {
  try {
    return sendMetadataToServer();
  } catch {}
}

export function getDesktopLogBuffer() {
  try {
    return getLogBuffer();
  } catch {
    return [];
  }
}

export function getDesktopInfo() {
  try {
    return getInfo();
  } catch {
    return null;
  }
}