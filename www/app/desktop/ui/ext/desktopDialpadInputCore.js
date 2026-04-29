export function initDesktopDialpadInputCore({
  dialInput,
  dialButtons,
  eraseBtn,
  callBtn,
  maxDialChars,
} = {}) {
  if (!dialInput) return;

  const MAX_DIAL_CHARS = maxDialChars;
  const ALLOWED_CHARS = "0123456789*#+";

  const emitDialInput = () => {
    dialInput.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const sanitizeDialValue = () => {
    const cleaned = [...dialInput.value].filter((c) => ALLOWED_CHARS.includes(c)).join("");
    dialInput.value = cleaned.slice(0, MAX_DIAL_CHARS);
  };

  const refreshDialUi = () => {
    const hasDigits = dialInput.value.length > 0;
    if (eraseBtn) {
      eraseBtn.classList.toggle("is-visible", hasDigits);
      eraseBtn.hidden = !hasDigits;
      eraseBtn.style.display = hasDigits ? "flex" : "none";
    }
  };

  const handleDialDigit = (digit) => {
    if (!digit) return;
    if (dialInput.value.length >= MAX_DIAL_CHARS) return;
    dialInput.value += digit;
    dialInput.focus();
    refreshDialUi();
    emitDialInput();
  };

  const handleDialBackspace = () => {
    if (!dialInput.value) return;
    dialInput.value = dialInput.value.slice(0, -1);
    refreshDialUi();
    emitDialInput();
  };

  const shouldHandleGlobalKey = (e) => {
    try {
      const t = e?.target;
      if (!t || !(t instanceof Element)) return true;
      if (t.id === "dial") return false;
      const tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return false;
      if (t.isContentEditable) return false;
      return true;
    } catch {
      return true;
    }
  };

  dialButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const digit = btn.getAttribute("data-digit");
      handleDialDigit(digit);
    });
  });

  let eraseRepeatTimer = null;
  let eraseRepeatInterval = null;
  let isErasing = false;

  const eraseOneDigit = () => {
    if (!dialInput.value) return;
    dialInput.value = dialInput.value.slice(0, -1);
    refreshDialUi();
    emitDialInput();
  };

  const startErase = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isErasing) return;
    isErasing = true;

    eraseOneDigit();

    eraseRepeatTimer = window.setTimeout(() => {
      eraseRepeatInterval = window.setInterval(() => {
        if (dialInput.value) {
          eraseOneDigit();
        } else {
          stopErase();
        }
      }, 90);
    }, 350);
  };

  const stopErase = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    isErasing = false;
    if (eraseRepeatTimer) {
      clearTimeout(eraseRepeatTimer);
      eraseRepeatTimer = null;
    }
    if (eraseRepeatInterval) {
      clearInterval(eraseRepeatInterval);
      eraseRepeatInterval = null;
    }
  };

  if (eraseBtn) {
    eraseBtn.addEventListener("mousedown", (e) => startErase(e));
    eraseBtn.addEventListener("mouseup", stopErase);
    eraseBtn.addEventListener("mouseleave", stopErase);
  }

  dialInput.addEventListener("input", () => {
    sanitizeDialValue();
    refreshDialUi();
  });

  dialInput.addEventListener("keydown", (e) => {
    if (!e) return;
    if (e.key === "Enter") {
      e.preventDefault();
      callBtn?.click?.();
      return;
    }
    if (e.key === "Backspace") {
      e.preventDefault();
      handleDialBackspace();
      return;
    }
    if (!ALLOWED_CHARS.includes(e.key)) return;
    if (dialInput.value.length >= MAX_DIAL_CHARS) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    handleDialDigit(e.key);
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (!e) return;
      if (!shouldHandleGlobalKey(e)) return;

      if (e.key === "Enter") {
        e.preventDefault();
        callBtn?.click?.();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        handleDialBackspace();
        return;
      }
      if (!ALLOWED_CHARS.includes(e.key)) return;
      if (dialInput.value.length >= MAX_DIAL_CHARS) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      handleDialDigit(e.key);
    },
    { capture: true }
  );

  dialInput.setAttribute("maxlength", String(MAX_DIAL_CHARS));
  sanitizeDialValue();
  refreshDialUi();
}
