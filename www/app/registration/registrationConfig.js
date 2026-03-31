import { ICE_SERVERS, ICE_TRANSPORT_POLICY } from "../config.js";

export function buildRegistrationConfig({ SIP, account, pass, wss, mobileCompatMode }) {
  const ext = account?.username;
  const domain = account?.domain;

  const sipUri = `sip:${ext}@${domain}`;
  const uri = SIP?.UserAgent?.makeURI ? SIP.UserAgent.makeURI(sipUri) : null;

  const iceTransportPolicy = mobileCompatMode ? "relay" : ICE_TRANSPORT_POLICY;
  const selectedProfile = iceTransportPolicy === "relay" ? "lte" : "wifi";

  const registrarUri = sipUri;
  const authorizationUsername = ext;

  const transportServer = wss;
  const transportOptions = {
    server: transportServer,
    connectionTimeout: 15,
    keepAliveInterval: 15,
    keepAliveDebounce: 3,
  };

  const peerConnectionConfiguration = {
    iceServers: ICE_SERVERS,
    iceTransportPolicy,
  };

  const userAgentOptions = {
    uri,
    authorizationUsername,
    authorizationPassword: pass,
    sipExtension100rel: "Supported",
    transportOptions,
    reconnectionAttempts: 999,
    reconnectionDelay: 2,
    sessionDescriptionHandlerFactoryOptions: {
      peerConnectionConfiguration,
    },
  };

  const registererOptions = {
    expires: 300,
  };

  const debugSummary = {
    sipUri,
    registrarUri,
    authorizationUsername,
    transportServer,
    iceTransportPolicy,
    selectedProfile,
  };

  return {
    sipUri,
    registrarUri,
    authorizationUsername,
    transportServer,
    transportOptions,
    iceServers: ICE_SERVERS,
    iceTransportPolicy,
    peerConnectionConfiguration,
    selectedProfile,
    userAgentOptions,
    registererOptions,
    debugSummary,
  };
}
