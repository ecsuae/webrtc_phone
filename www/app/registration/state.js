import { createRegistrationState } from "./registrationState.js";

export function createAppState() {
  const registration = createRegistrationState();

  const st = {
    registration,
    sbcUa: null,
    sbcReg: null,
    registered: false,
    registering: false,
    session: null,
    incomingInvitation: null,
  };

  Object.defineProperties(st, {
    ua: {
      enumerable: true,
      get: () => st.registration.ua,
      set: (v) => {
        st.registration.ua = v;
      },
    },
    reg: {
      enumerable: true,
      get: () => st.registration.registerer,
      set: (v) => {
        st.registration.registerer = v;
      },
    },
    account: {
      enumerable: true,
      get: () => st.registration.sipAccountRaw,
      set: (v) => {
        st.registration.sipAccountRaw = v;
      },
    },
    selectedProfile: {
      enumerable: true,
      get: () => st.registration.selectedProfile,
      set: (v) => {
        st.registration.selectedProfile = v;
      },
    },
  });

  return st;
}
