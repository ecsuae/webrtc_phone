export function initDialpadInput() {
  const dialInput = document.getElementById("dial");
  const dialButtons = document.querySelectorAll(".dial-btn");
  const eraseBtn = document.getElementById("btnDialErase");
  if (!dialInput) return;

  const MAX_DIAL_CHARS = 12;
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
    console.log("[dialpad] refreshDialUi called - hasDigits:", hasDigits, "value:", dialInput.value);
    if (eraseBtn) {
      eraseBtn.classList.toggle("is-visible", hasDigits);
      eraseBtn.hidden = !hasDigits;
      eraseBtn.style.display = hasDigits ? "flex" : "none";
      console.log("[dialpad] eraseBtn visibility:", hasDigits, "inline:", eraseBtn.style.display, "computed:", window.getComputedStyle(eraseBtn).display);
    } else {
      console.log("[dialpad] eraseBtn not found!");
    }
  };

  let lastTouchAt = 0;
  const handleDialDigit = (digit) => {
    if (!digit) return;
    if (dialInput.value.length >= MAX_DIAL_CHARS) return;
    dialInput.value += digit;
    console.log("[dialpad] after adding digit, value:", dialInput.value);
    dialInput.focus();
    refreshDialUi();
    emitDialInput();
  };

  dialButtons.forEach((btn) => {
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      lastTouchAt = Date.now();
      const digit = btn.getAttribute("data-digit");
      console.log("[dialpad] touch dial button, digit:", digit);
      handleDialDigit(digit);
    }, { passive: false });

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (Date.now() - lastTouchAt < 700) {
        return;
      }
      const digit = btn.getAttribute("data-digit");
      console.log("[dialpad] dial button clicked, digit:", digit);
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

    // Immediate delete on press.
    eraseOneDigit();

    // After short delay, continuously delete while pressed.
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
    // Primary: Mouse events for desktop
    eraseBtn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startErase(e);
    });
    eraseBtn.addEventListener("mouseup", stopErase);
    eraseBtn.addEventListener("mouseleave", stopErase);

    // Primary: Touch events for mobile
    eraseBtn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      e.stopPropagation();
      startErase(e);
    }, { passive: false });
    eraseBtn.addEventListener("touchend", (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopErase(e);
    }, { passive: false });
    eraseBtn.addEventListener("touchcancel", stopErase, { passive: false });
  }

  dialInput.addEventListener("input", () => {
    console.log("[dialpad] input event fired, value:", dialInput.value);
    sanitizeDialValue();
    refreshDialUi();
  });

  dialInput.addEventListener("keypress", (e) => {
    if (!ALLOWED_CHARS.includes(e.key) && e.key !== "Enter") {
      e.preventDefault();
      return;
    }
    if (ALLOWED_CHARS.includes(e.key) && dialInput.value.length >= MAX_DIAL_CHARS) {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      document.getElementById("btnCall")?.click();
    }
  });

  dialInput.setAttribute("maxlength", String(MAX_DIAL_CHARS));
  sanitizeDialValue();

  refreshDialUi();
}
