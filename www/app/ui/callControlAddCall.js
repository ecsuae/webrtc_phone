// Add Call Button - Creates a second SIP session for dual-call management
import { addSecondCall } from "../outgoing/addCall.js";
import { dualSessionManager } from "../features/dualSessionManager.js";

function normalizeTarget(value) {
  return String(value || "").trim();
}

export function initializeAddCallButton(SIP, st, ui, button) {
  if (!button) return;

  button.addEventListener("click", async () => {
    if (!st?.session) {
      alert("No active call");
      return;
    }

    if (!dualSessionManager.canAddCall()) {
      alert("Cannot add another call");
      return;
    }

    const number = normalizeTarget(prompt("Enter number/extension to add:"));
    if (!number) return;

    button.disabled = true;
    const prevLabel = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

    try {
      // Create second SIP session
      const result = await addSecondCall(SIP, st, ui, number);
      
      if (!result.success) {
        alert(`Add call failed: ${result.error}`);
        return;
      }

      button.classList.add("active");
      setTimeout(() => button.classList.remove("active"), 1200);
      
    } catch (err) {
      console.error("[AddCall] failed:", err);
      alert("Add call failed: " + (err?.message || err));
    } finally {
      button.disabled = false;
      button.innerHTML = prevLabel;
    }
  });
}
