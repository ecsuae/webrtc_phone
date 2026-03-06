export function setupTabNavigation() {
  const tabButtons = document.querySelectorAll(".tab-btn[data-tab]");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(tabId)?.classList.add("active");
    });
  });
}
