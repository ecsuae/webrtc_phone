export function createCallTimer() {
  let callStartTime = null;
  let callTimerInterval = null;

  const start = () => {
    if (callStartTime) return;
    callStartTime = Date.now();
    const timerDisplay = document.getElementById("timerDisplay");
    const callTimerDiv = document.getElementById("callTimer");
    if (callTimerDiv) callTimerDiv.style.display = "block";
    if (callTimerInterval) clearInterval(callTimerInterval);

    callTimerInterval = setInterval(() => {
      if (!callStartTime || !timerDisplay) return;
      const elapsed = Math.floor((Date.now() - callStartTime) / 1000);
      const hours = Math.floor(elapsed / 3600);
      const minutes = Math.floor((elapsed % 3600) / 60);
      const seconds = elapsed % 60;
      timerDisplay.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }, 1000);
  };

  const stop = () => {
    if (callTimerInterval) clearInterval(callTimerInterval);
    callTimerInterval = null;
    callStartTime = null;
    const callTimerDiv = document.getElementById("callTimer");
    const timerDisplay = document.getElementById("timerDisplay");
    if (callTimerDiv) callTimerDiv.style.display = "none";
    if (timerDisplay) timerDisplay.textContent = "00:00:00";
  };

  return { start, stop };
}
