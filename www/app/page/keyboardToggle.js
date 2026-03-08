export function initKeyboardToggle() {
  const dialInput = document.getElementById("dial");
  const toggleBtn = document.getElementById("btnToggleKeyboard");

  if (!dialInput || !toggleBtn) return;

  const isMobile = window.matchMedia("(max-width: 767.98px)").matches;

  // Desktop: no toggle button needed, allow direct typing.
  if (!isMobile) {
    dialInput.removeAttribute("readonly");
    toggleBtn.style.setProperty("display", "none");
    return;
  }

  // Mobile: keep readonly until user explicitly enables native keyboard.
  dialInput.setAttribute("readonly", "readonly");

  let keyboardActive = false;

  function activateKeyboard() {
    dialInput.removeAttribute("readonly");
    // Input mode hint helps mobile browsers open numeric keypad.
    dialInput.setAttribute("inputmode", "tel");

    const focusInput = () => {
      dialInput.focus({ preventScroll: true });
      dialInput.click();
      const endPos = dialInput.value.length;
      try {
        dialInput.setSelectionRange(endPos, endPos);
      } catch {
        // Some mobile browsers throw on setSelectionRange for type=tel.
      }
    };

    // Multiple focus attempts improve Android keyboard reliability.
    focusInput();
    requestAnimationFrame(focusInput);
    setTimeout(focusInput, 60);

    toggleBtn.classList.add("active");
    keyboardActive = true;
  }

  function deactivateKeyboard() {
    dialInput.setAttribute("readonly", "readonly");
    dialInput.blur();
    toggleBtn.classList.remove("active");
    keyboardActive = false;
  }

  toggleBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    if (keyboardActive) {
      deactivateKeyboard();
      return;
    }

    activateKeyboard();
  });

  // Keep readonly off only while toggle is active; outside tap closes keyboard and syncs button state.
  dialInput.addEventListener("blur", () => {
    if (!keyboardActive) {
      dialInput.setAttribute("readonly", "readonly");
      toggleBtn.classList.remove("active");
    }
  });

  // Prevent input from triggering keyboard on touch
  dialInput.addEventListener("touchstart", (e) => {
    if (dialInput.hasAttribute("readonly")) {
      e.preventDefault();
    }
  });

  document.addEventListener("pointerdown", (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!keyboardActive) return;

    const clickedInsideDisplay = target.closest(".dial-display");
    if (clickedInsideDisplay) return;

    deactivateKeyboard();
  });
}
