/**
 * Registration Diagnostics Catalog — regDiagCatalog.js
 *
 * Authoritative source for all REG-E error codes.
 *
 * shortLabel  — user-safe text shown on the login page (no tech jargon)
 * longDescription — full technical explanation for admin/ops use
 * likelyLayer     — which system layer owns the failure
 * commonCauses    — string[] of likely root causes
 * recommendedChecks — string[] of diagnostic actions
 */

export { ERROR_CATALOG, ERROR_MAP, STEP_LABELS } from "./diagnostics/index.js";
