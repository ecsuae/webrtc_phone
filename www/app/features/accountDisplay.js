/**
 * Account Display Feature
 * Handles formatting and updating the status bar with username and domain
 * Separated feature file to avoid modifying core UI logic
 */

export function initAccountDisplay() {
  console.log("[accountDisplay] Initializing account display feature");
}

/**
 * Format domain to show only first part with capitalized first letter
 * Example: "fusn02.srve.cc" -> "Fusn02"
 */
export function formatDomainDisplay(domain) {
  if (!domain) return "-";
  const domainPart = domain.split(".")[0]; // Get first part before dot
  return domainPart.charAt(0).toUpperCase() + domainPart.slice(1).toLowerCase();
}

/**
 * Update only the username in the status bar (left side)
 * Username: bold, larger (18px), no @ sign
 */
export function updateUsernameDisplay(username, statusElement) {
  if (!statusElement) return;
  const usernameSpan = document.createElement("span");
  usernameSpan.className = "account-username";
  usernameSpan.textContent = username || "-";
  statusElement.innerHTML = "";
  statusElement.appendChild(usernameSpan);
}

/**
 * Update only the domain in the status bar (right side)
 * Domain: bold, 18px (same style as username)
 */
export function updateDomainDisplay(domain, domainElement) {
  if (!domainElement) return;
  const formattedDomain = formatDomainDisplay(domain);
  const domainSpan = document.createElement("span");
  domainSpan.className = "account-domain-right";
  domainSpan.textContent = formattedDomain;
  domainElement.innerHTML = "";
  domainElement.appendChild(domainSpan);
}
