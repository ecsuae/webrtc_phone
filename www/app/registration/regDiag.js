/**
 * Registration Diagnostics — regDiag.js
 *
 * Isolated state machine that tracks registration progress and errors.
 * Renders a compact widget in #regDiagWidget.
 *
 * Frontend display rules:
 *   - Error state shows: "Registration failed" + code + shortLabel only
 *   - No internal technology names (SIP, WSS, Kamailio, PBX, transport) in visible text
 *   - Technical detail is kept in _errorDetail (for timer logic) but not displayed
 *   - Full catalog with technical explanations lives in regDiagCatalog.js
 *
 * Usage:
 *   diagInit()                  — reset and show widget (call at start of each attempt)
 *   diagStep("REG-006")         — advance to next step (clears any active error)
 *   diagError("REG-E003", msg)  — set error state with optional detail string (not shown to user)
 *   diagClear()                 — hide widget (call on successful registration)
 *   diagStartConnectTimer(ms)   — fire REG-E003 if Connected doesn't arrive in time
 *   diagCancelConnectTimer()    — cancel the above
 *   diagStartResponseTimer(ms)  — fire REG-E005 if no response arrives in time
 *   diagCancelResponseTimer()   — cancel the above
 */

import { ERROR_MAP, STEP_LABELS } from "./regDiagCatalog.js";

// --- internal state ---
let _step = null;
let _error = null;
let _errorDetail = null;  // kept for timer diagnostics; NOT shown to user
let _traceId = null;
let _responseTimer = null;
let _connectTimer = null;

// --- public API ---

export function diagInit() {
  _step = null;
  _error = null;
  _errorDetail = null;
  _traceId = _makeTraceId();
  _clearResponseTimer();
  _clearConnectTimer();
  _render();
}

export function diagStep(code) {
  _step = code;
  _error = null;
  _errorDetail = null;
  _render();
}

export function diagError(code, detail = null) {
  _error = code;
  _errorDetail = detail || null;
  // Log technical detail to console for devtools debugging — not shown in the UI
  if (_errorDetail) console.debug(`[regDiag] ${code} detail: ${_errorDetail}`);
  _clearResponseTimer();
  _clearConnectTimer();
  _render();
}

export function diagClear() {
  _step = null;
  _error = null;
  _errorDetail = null;
  _traceId = null;
  _clearResponseTimer();
  _clearConnectTimer();
  _render();
}

export function diagStartConnectTimer(ms = 20000) {
  _clearConnectTimer();
  _connectTimer = setTimeout(() => {
    if (_step === "REG-005" && !_error) {
      diagError("REG-E003", `no Connected event within ${Math.round(ms / 1000)}s`);
    }
  }, ms);
}

export function diagCancelConnectTimer() {
  _clearConnectTimer();
}

export function diagStartResponseTimer(ms = 30000) {
  _clearResponseTimer();
  _responseTimer = setTimeout(() => {
    if ((_step === "REG-007" || _step === "REG-009") && !_error) {
      diagError("REG-E005", `no response within ${Math.round(ms / 1000)}s`);
    }
  }, ms);
}

export function diagCancelResponseTimer() {
  _clearResponseTimer();
}

// --- private helpers ---

function _makeTraceId() {
  const hex = Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, "0");
  return `T-${hex}`;
}

function _clearResponseTimer() {
  if (_responseTimer !== null) {
    clearTimeout(_responseTimer);
    _responseTimer = null;
  }
}

function _clearConnectTimer() {
  if (_connectTimer !== null) {
    clearTimeout(_connectTimer);
    _connectTimer = null;
  }
}

function _render() {
  const el = document.getElementById("regDiagWidget");
  if (!el) return;

  if (!_step && !_error) {
    el.style.display = "none";
    el.innerHTML = "";
    return;
  }

  el.style.display = "";

  const isError = !!_error;
  const isDone = _step === "REG-010" && !_error;
  const dotColor = isError ? "#ef4444" : isDone ? "#22c55e" : "#f59e0b";

  // Bar text — safe for users to read
  const stepLabel = STEP_LABELS[_step] || _step || "";
  const errorEntry = _error ? (ERROR_MAP[_error] || null) : null;
  const shortLabel = errorEntry ? errorEntry.shortLabel : (_error || "");

  // Summary bar: either "step label" or "Registration failed"
  const barText = isError ? "Registration failed" : stepLabel;

  // Code+label line shown only in error state
  const codeText = isError ? `${_error}: ${shortLabel}` : "";

  // Expanded detail — step label and trace ID only (no tech detail string)
  const stepLineForDetail = _step && STEP_LABELS[_step] ? `${_step} — ${STEP_LABELS[_step]}` : "";

  el.innerHTML = `
    <div class="diag-bar">
      <span class="diag-dot" style="background:${dotColor};"></span>
      <span class="diag-text">
        ${_escHtml(barText)}
        ${isError ? `<span class="diag-code">${_escHtml(codeText)}</span>` : ""}
      </span>
      <button type="button" class="diag-expand-btn" onclick="
        var d = this.closest('.diag-bar').nextElementSibling;
        d.classList.toggle('diag-hidden');
        this.textContent = d.classList.contains('diag-hidden') ? '&#9660;' : '&#9650;';
      ">&#9660;</button>
    </div>
    <div class="diag-detail diag-hidden">
      ${stepLineForDetail ? `<div><span class="diag-lbl">Step:</span> ${_escHtml(stepLineForDetail)}</div>` : ""}
      ${_traceId ? `<div><span class="diag-lbl">Trace ID:</span> ${_escHtml(_traceId)} <span class="diag-hint">(include in support reports)</span></div>` : ""}
    </div>
  `;
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
