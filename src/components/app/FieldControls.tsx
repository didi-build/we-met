"use client";

import { maxForField } from "@/lib/app-editor/validation";

export function FieldError({ message, id }: { message: string; id: string }) {
  if (!message) {
    return <p className="ap-err" id={id} hidden />;
  }
  return (
    <p className="ap-err" id={id} role={message ? "alert" : undefined}>
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </p>
  );
}

export function CharCount({
  fieldKey,
  length,
  id,
}: {
  fieldKey: string;
  length: number;
  id: string;
}) {
  const max = maxForField(fieldKey);
  if (!max) {
    return null;
  }
  const show = length >= max * 0.8;
  return (
    <span
      className="ap-count"
      id={id}
      hidden={!show}
      data-over={length > max ? "true" : "false"}
    >
      {length} / {max}
    </span>
  );
}
