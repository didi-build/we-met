/**
 * Mirrors src/app-auth/preview-login.ts for deploy-time guards (no TS import).
 */
export function isPreviewLoginEnvironment(weMetEnv) {
  return weMetEnv?.trim() === "preview";
}

export function previewLoginWouldBeEnabled(weMetEnv, secretConfigured) {
  return isPreviewLoginEnvironment(weMetEnv) && secretConfigured;
}

/** Route must not be reachable under production or local Worker env (DIDI-617). */
export function previewLoginReachableForWorkerEnv(weMetEnv, secretConfigured) {
  return previewLoginWouldBeEnabled(weMetEnv, Boolean(secretConfigured));
}

export function assertPreviewLoginUnreachableOutsidePreview(weMetEnv) {
  if (previewLoginReachableForWorkerEnv(weMetEnv, true)) {
    return false;
  }
  return true;
}
