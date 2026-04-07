export function getCookie(name) {
  try {
    const prefix = `${name}=`;
    const parts = document.cookie.split(";").map((s) => s.trim());
    const found = parts.find((p) => p.startsWith(prefix));
    return found ? decodeURIComponent(found.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

export function setCookie(name, value, days = 3650) {
  try {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {
    // Ignore cookie write failures.
  }
}
