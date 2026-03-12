// Generated config for web app. Contains runtime values from server .env
window.APP_CONFIG = window.APP_CONFIG || {
  PBX_IP: (document?.body?.dataset?.sipDomain || "").trim(),
  WSS_HOST: (document?.body?.dataset?.wssHost || "").trim(),
  TURN_HOST: (document?.body?.dataset?.turnHost || document?.body?.dataset?.wssHost || "").trim(),
  SKIN: (document?.body?.dataset?.skin || "modern-ops").trim(),
  TURN_USER: (document?.body?.dataset?.turnUser || "").trim(),
  TURN_PASS: (document?.body?.dataset?.turnPass || "").trim(),
};
