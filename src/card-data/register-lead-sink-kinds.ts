import { registerEmailLeadSinkKind } from "@/card-data/lead-sink-kinds/email";

export function registerBuiltInLeadSinkKinds(): void {
  registerEmailLeadSinkKind();
}

/** Test-only: kept for callers that reset sink kinds between cases. */
export function resetBuiltInLeadSinkKindsForTests(): void {
  // registerBuiltInLeadSinkKinds is idempotent via registry.set.
}
