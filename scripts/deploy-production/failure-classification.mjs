import { parseGhHttpStatus } from "../lib/gh-api-errors.mjs";
import { sanitizeExternalPlanText } from "./messages.mjs";

const DETAIL_MAX_LENGTH = 200;

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

/**
 * @param {unknown} error
 * @returns {string}
 */
export function errorToDiagnosticText(error) {
  /** @type {string[]} */
  const parts = [];
  if (error && typeof error === "object") {
    if ("stderr" in error && typeof error.stderr === "string" && error.stderr) {
      parts.push(error.stderr);
    }
    if ("message" in error && typeof error.message === "string" && error.message) {
      parts.push(error.message);
    }
  } else if (typeof error === "string") {
    parts.push(error);
  }
  return parts.join(" ").trim();
}

/**
 * @param {string} text
 * @returns {number | null}
 */
export function extractHttpStatusFromError(error) {
  const text = errorToDiagnosticText(error);
  return parseGhHttpStatus(text);
}

/**
 * @param {string} text
 * @returns {boolean}
 */
export function isRateLimitResponse(text, httpStatus) {
  if (httpStatus === 429) {
    return true;
  }
  if (httpStatus === 403 && /rate limit/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * @param {string} text
 * @param {number | null} httpStatus
 * @returns {boolean}
 */
export function isAccessOrConfigHttpError(text, httpStatus) {
  if (httpStatus === 401) {
    return true;
  }
  if (httpStatus === 403 && !isRateLimitResponse(text, httpStatus)) {
    return true;
  }
  if (httpStatus === 404) {
    return /\/deployments|\/compare\/|repos\/[^/]+\/[^/]+\/compare\//i.test(text);
  }
  return false;
}

/**
 * @param {string} text
 * @param {number | null} httpStatus
 * @returns {boolean}
 */
export function isGitHubUnavailableError(error, text, httpStatus) {
  if (httpStatus != null && httpStatus >= 500) {
    return true;
  }
  if (isRateLimitResponse(text, httpStatus)) {
    return true;
  }
  if (error && typeof error === "object" && "code" in error) {
    const code = error.code;
    if (typeof code === "string" && NETWORK_ERROR_CODES.has(code)) {
      return true;
    }
  }
  if (/timeout|network|socket hang up/i.test(text)) {
    return true;
  }
  return false;
}

/**
 * @param {string} raw
 * @returns {string}
 */
export function shortenFailureDetail(raw) {
  let detail = raw
    .replace(/\{[\s\S]*\}/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!detail) {
    detail = "unknown error";
  }
  detail = sanitizeExternalPlanText(detail);
  if (detail.length > DETAIL_MAX_LENGTH) {
    detail = `${detail.slice(0, DETAIL_MAX_LENGTH - 1)}…`;
  }
  return detail;
}

/**
 * @typedef {"github_unavailable" | "access_or_config" | "bug"} PlanFailureCategory
 * @typedef {{ category: PlanFailureCategory; detail: string }} PlanFailureClassification
 */

/**
 * @param {unknown} error
 * @returns {PlanFailureClassification}
 */
export function classifyPlanFailure(error) {
  const text = errorToDiagnosticText(error);
  const httpStatus = parseGhHttpStatus(text);

  if (isGitHubUnavailableError(error, text, httpStatus)) {
    return {
      category: "github_unavailable",
      detail: shortenFailureDetail(text || `HTTP ${httpStatus ?? "unknown"}`),
    };
  }

  if (isAccessOrConfigHttpError(text, httpStatus)) {
    return {
      category: "access_or_config",
      detail: shortenFailureDetail(text || `HTTP ${httpStatus ?? "unknown"}`),
    };
  }

  return {
    category: "bug",
    detail: shortenFailureDetail(text || "unknown error"),
  };
}
