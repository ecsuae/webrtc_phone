export function attachTransportEvents({
  st,
  getHasActiveCall,
  onState,
  onConnected,
  onDisconnected,
}) {
  st.ua.transport?.stateChange?.addListener?.((state) => {
    const normalized = String(state);
    onState?.(normalized);

    if (normalized === "Connected") {
      onConnected?.();
      return;
    }

    if (normalized === "Disconnected" || normalized === "Disconnecting") {
      if (!getHasActiveCall?.()) {
        st.registered = false;
      }
      onDisconnected?.(normalized);
    }
  });
}

export function createRegistererDelegate({ st, onAccept, onReject }) {
  return {
    onAccept: (r) => {
      st.registered = true;
      st.registering = false;
      onAccept?.(r);
    },
    onReject: (r) => {
      st.registered = false;
      st.registering = false;
      onReject?.(r);
    },
  };
}

export function attachRegistererStateEvents({ st, onStateChange }) {
  st.reg.stateChange?.addListener?.((s) => {
    const low = String(s).toLowerCase();

    if (low.includes("registered")) st.registered = true;
    if (low.includes("unregistered") || low.includes("terminated")) st.registered = false;

    onStateChange?.(s);
  });
}
