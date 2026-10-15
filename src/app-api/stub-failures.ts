/** URL query flags read only by the stub (`?stub=login-error,save-error,...`). */
export type StubFailureFlag =
  | "login-error"
  | "closed"
  | "slug-taken"
  | "save-error"
  | "session-expired"
  | "upload-error";

export function readStubFailureFlags(search: string): Set<StubFailureFlag> {
  const params = new URLSearchParams(search);
  const raw = params.get("stub");
  if (!raw) {
    return new Set();
  }
  const allowed: StubFailureFlag[] = [
    "login-error",
    "closed",
    "slug-taken",
    "save-error",
    "session-expired",
    "upload-error",
  ];
  const out = new Set<StubFailureFlag>();
  for (const part of raw.split(",")) {
    const trimmed = part.trim() as StubFailureFlag;
    if (allowed.includes(trimmed)) {
      out.add(trimmed);
    }
  }
  return out;
}
