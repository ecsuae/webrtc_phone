export function initDialpadInput() {
  const dialInput = document.getElementById("dial");
  const dialButtons = document.querySelectorAll(".dial-btn");
  if (!dialInput) return;

  dialButtons.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const digit = btn.getAttribute("data-digit");
      if (!digit) return;
      dialInput.value += digit;
      dialInput.focus();
    });
  });

  dialInput.addEventListener("keypress", (e) => {
    const allowed = "0123456789*#+";
    if (!allowed.includes(e.key) && e.key !== "Enter") {
      e.preventDefault();
      return;
    }
    if (e.key === "Enter") {
      document.getElementById("btnCall")?.click();
    }
  });
}
