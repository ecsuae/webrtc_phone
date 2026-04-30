export function createUserAgent({ SIP, userAgentOptions, delegate }) {
  return new SIP.UserAgent({
    ...userAgentOptions,
    delegate,
  });
}

export async function startUserAgent({ st, ua }) {
  st.ua = ua;
  await ua.start();
}

export function createRegisterer({ SIP, st, ua, registererOptions, delegate }) {
  const reg = new SIP.Registerer(ua, {
    ...registererOptions,
    delegate,
  });
  st.reg = reg;
  return reg;
}

export function sendRegister({ st }) {
  st.registering = true;
  return st.reg.register();
}

export async function unregister({ st }) {
  try {
    await st.reg?.unregister?.();
  } catch {}
  st.registered = false;
  st.registering = false;
}

export async function stopUserAgent({ st }) {
  try {
    await st.ua?.stop?.();
  } catch {}
  st.ua = null;
}

export function clearRegistrationObjects({ st }) {
  st.reg = null;
  st.account = null;
}

export async function stopRegistrationExecution({ st }) {
  await unregister({ st });
  await stopUserAgent({ st });
  clearRegistrationObjects({ st });
}
