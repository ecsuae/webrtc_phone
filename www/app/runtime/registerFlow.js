import { createRegistrationActions } from "../registration/registrationActions.js";

export function createRegisterFlow({ SIP, st, ui, startAndRegister, acquireWakeLock, logLine }) {
  const actions = createRegistrationActions({
    SIP,
    st,
    ui,
    startAndRegister,
    acquireWakeLock,
    logLine,
  });

  return {
    runOneTapEnableFlow: actions.enableCalls,
  };
}
