import { parseGhHttpStatus } from "../lib/gh-api-errors.mjs";
import { formatGhApiExecBufferExceededDetail } from "../lib/privileged-gh-api.mjs";

const DETAIL_MAX_LENGTH = 200;

const NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ENOTFOUND",
  "ETIMEDOUT",
  "EAI_AGAIN",
]);

const GH_NETWORK_MESSAGE_RE =
  /dial tcp|i\/o timeout|connection reset|TLS handshake timeout|socket hang up/i;

/**
 * @param {unknown} chunk
 * @returns {string}
 */
function stringifyDiagnosticChunk(chunk) {
  if (typeof chunk === "string") {
    return chunk;
  }
  if (chunk != null && typeof chunk === "object" && "toString" in chunk) {
    const text = chunk.toString();
    if (typeof text === "string") {
      return text;
    }
  }
  return "";
}

/**
 * @param {unknown} error
 * @returns {string}
 */
export function errorToDiagnosticText(error) {
  /** @type {string[]} */
  const parts = [];
  if (error && typeof error === "object") {
    if ("stderr" in error && error.stderr) {
      parts.push(stringifyDiagnosticChunk(error.stderr));
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
 * @param {unknown} error
 * @returns {number | null}
 */
export function extractHttpStatusFromError(error) {
  return parseGhHttpStatus(errorToDiagnosticText(error));
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
 * @param {unknown} error
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
  if (GH_NETWORK_MESSAGE_RE.test(text)) {
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
 * @returns {boolean}
 */
export function isExecBufferExceededError(error) {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "ENOBUFS"
  ) {
    return true;
  }
  const text = errorToDiagnosticText(error);
  return /maxBuffer|ENOBUFS/i.test(text);
}

/**
 * @param {unknown} error
 * @returns {PlanFailureClassification}
 */
export function classifyPlanFailure(error) {
  if (isExecBufferExceededError(error)) {
    return {
      category: "bug",
      detail: formatGhApiExecBufferExceededDetail(),
    };
  }

  const text = errorToDiagnosticText(error);
  const httpStatus = extractHttpStatusFromError(error);

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
