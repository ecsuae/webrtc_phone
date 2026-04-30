import { initDesktopDialpadInputCore } from "./ext/desktopDialpadInputCore.js";

export function initDesktopDialpadInput() {
  const dialInput = document.getElementById("dial");
  const dialButtons = document.querySelectorAll(".dial-btn");
  const eraseBtn = document.getElementById("btnDialErase");
  if (!dialInput) return;

  const cfgMax = Number(document.body?.dataset?.maxDialDigits || "");
  const MAX_DIAL_CHARS = Number.isFinite(cfgMax) && cfgMax > 0 ? cfgMax : 15;

  initDesktopDialpadInputCore({
    dialInput,
    dialButtons,
    eraseBtn,
    callBtn: document.getElementById("btnCall"),
    maxDialChars: MAX_DIAL_CHARS,
  });
}

export function initDesktopKeyboardToggle() {
  const dialInput = document.getElementById("dial");
  const toggleBtn = document.getElementById("btnToggleKeyboard");

  if (!dialInput) return;

  dialInput.removeAttribute("readonly");
  dialInput.setAttribute("inputmode", "tel");
  try {
    if (toggleBtn) {
      toggleBtn.addEventListener("click", (e) => {
        try {
          e?.preventDefault?.();
        } catch {}
        try {
          console.log(`[desktop:dialpad] keyboard icon focus ts=${Date.now()} value=${dialInput.value || ""}`);
        } catch {}
        try {
          dialInput.focus({ preventScroll: true });
          dialInput.click();
          const endPos = dialInput.value.length;
          try {
            dialInput.setSelectionRange(endPos, endPos);
          } catch {}
        } catch {}
      });
      toggleBtn.style.setProperty("display", "");
    }
  } catch {}
}
