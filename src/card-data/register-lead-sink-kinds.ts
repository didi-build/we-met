import { registerEmailLeadSinkKind } from "@/card-data/lead-sink-kinds/email";

let registered = false;

export function registerBuiltInLeadSinkKinds(): void {
  if (registered) {
    return;
  }
  registerEmailLeadSinkKind();
  registered = true;
}

/** Test-only: reset registration guard between cases. */
export function resetBuiltInLeadSinkKindsForTests(): void {
  registered = false;
}
