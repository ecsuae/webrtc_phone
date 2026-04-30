export function waitForDesktopRegistration(st, timeoutMs = 8000) {
  return new Promise((resolve) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (st.registered) {
        clearInterval(timer);
        resolve(true);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, 250);
  });
}
