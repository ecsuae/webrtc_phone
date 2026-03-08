/**
 * MOBI Logo Feature
 * Generates the MOBI logo with WiFi icon integrated into M
 * Modular feature for easy customization
 */

export function getMobiLogo() {
  // SVG MOBI logo with WiFi integrated into the letter M - solid filled with gradient
  return `
    <svg class="mobi-logo" viewBox="0 0 320 90" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="mobiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#1E40AF;stop-opacity:1" />
          <stop offset="40%" style="stop-color:#3B82F6;stop-opacity:1" />
          <stop offset="70%" style="stop-color:#60A5FA;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#0EA5E9;stop-opacity:1" />
        </linearGradient>
        <filter id="logoShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.2"/>
        </filter>
      </defs>
      
      <g filter="url(#logoShadow)">
        <!-- WiFi arcs integrated into M -->
        <path d="M 8 42 Q 3 35 3 28" fill="none" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" opacity="0.9"/>
        <path d="M 5 37 Q -2 28 -2 20" fill="none" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" opacity="0.8"/>
        <path d="M 2 32 Q -7 21 -7 12" fill="none" stroke="#60A5FA" stroke-width="3" stroke-linecap="round" opacity="0.7"/>
        
        <!-- MOBI Text - Solid filled -->
        <text x="18" y="68" font-family="Arial, Helvetica, sans-serif" font-size="64" font-weight="900" fill="url(#mobiGradient)" letter-spacing="-2">MOBI</text>
      </g>
    </svg>
  `;
}

export function initMobiLogo() {
  console.log("[mobiLogo] MOBI logo feature initialized");
}
