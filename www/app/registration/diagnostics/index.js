import { ERROR_CATALOG } from "./errorCatalog.js";
import { STEP_LABELS } from "./stepLabels.js";

export { ERROR_CATALOG, STEP_LABELS };

export const ERROR_MAP = Object.fromEntries(
  ERROR_CATALOG.map((e) => [e.code, e]),
);
