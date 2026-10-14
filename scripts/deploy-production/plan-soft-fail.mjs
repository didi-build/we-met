import { classifyPlanFailure } from "./failure-classification.mjs";
import {
  buildPlanFailureContent,
  buildPlanSetupFailureContent,
  buildPlanStepCrashFailureContent,
} from "./messages.mjs";
import { emitWorkflowWarning } from "./workflow-output.mjs";

/**
 * @param {unknown} error
 * @returns {{ exitCode: number; summaryMarkdown: string; warningAnnotation: string; category: string }}
 */
export function executePlanSoftFail(error) {
  const classified = classifyPlanFailure(error);
  const { summaryMarkdown, warningAnnotation } = buildPlanFailureContent(classified);
  emitWorkflowWarning(warningAnnotation);
  console.error(sanitizeDetailForLog(classified.detail));
  return {
    exitCode: 0,
    summaryMarkdown,
    warningAnnotation,
    category: classified.category,
  };
}

/**
 * @param {string} detail
 * @returns {string}
 */
function sanitizeDetailForLog(detail) {
  return detail.replace(/[\0-\x1F\x7F]/g, " ");
}

/**
 * @param {string} failedStepId
 * @returns {{ exitCode: number; summaryMarkdown: string; warningAnnotation: string }}
 */
export function executePlanSetupSoftFail(failedStepId) {
  const { summaryMarkdown, warningAnnotation } =
    buildPlanSetupFailureContent(failedStepId);
  emitWorkflowWarning(warningAnnotation);
  return { exitCode: 0, summaryMarkdown, warningAnnotation };
}

/**
 * @returns {{ exitCode: number; summaryMarkdown: string; warningAnnotation: string }}
 */
export function executePlanStepCrashSoftFail() {
  const { summaryMarkdown, warningAnnotation } = buildPlanStepCrashFailureContent();
  emitWorkflowWarning(warningAnnotation);
  return { exitCode: 0, summaryMarkdown, warningAnnotation };
}
