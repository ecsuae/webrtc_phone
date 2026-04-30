export function createRegistrationState() {
  return {
    // Registration-owned input/config state
    sipAccountRaw: null,
    username: null,
    domain: null,
    selectedProfile: null,
    iceTransportPolicy: null,

    // Enable-calls / gating state
    callsEnabled: false,
    callsEnabledPersisted: false,
    enableRequestedAt: null,
    platform: null,
    hasExplicitEnableForSession: false,
    hasEverRegisteredThisSession: false,
    isBootRecovered: false,

    // SIP.js / transport objects
    ua: null,
    registerer: null,

    // Registration status observability
    status: null,
    transportState: null,
    registrationState: null,

    // Error and timing diagnostics
    lastError: null,
    lastErrorAt: null,
    lastRegisterCallId: null,
    lastRegisterAttemptAt: null,
    lastRegisteredAt: null,
    lastUnregisteredAt: null,
  };
}
