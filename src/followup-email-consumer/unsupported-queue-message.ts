export class UnsupportedQueueMessageError extends Error {
  readonly typeLabel: string;

  constructor(typeLabel: string) {
    super(`unsupported_queue_message_type:${typeLabel}`);
    this.name = "UnsupportedQueueMessageError";
    this.typeLabel = typeLabel;
  }
}
