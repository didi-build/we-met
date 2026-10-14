import { classifyPlanFailure } from "./failure-classification.mjs";
import { buildPlanFailureContent, buildPlanSetupFailureContent } from "./messages.mjs";
import { emitWorkflowWarning } from "./workflow-output.mjs";

/**
 * @param {unknown} error
 * @returns {{ exitCode: number; summaryMarkdown: string; warningAnnotation: string; category: string }}
 */
export function executePlanSoftFail(error) {
  const classified = classifyPlanFailure(error);
  const { summaryMarkdown, warningAnnotation } = buildPlanFailureContent(classified);
  emitWorkflowWarning(warningAnnotation);
  console.error(classified.detail);
  return {
    exitCode: 0,
    summaryMarkdown,
    warningAnnotation,
    category: classified.category,
  };
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
