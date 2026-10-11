export type LeadSinkConfigSchema<T = unknown> = {
  parse: (value: unknown) => T;
};

const registry = new Map<string, LeadSinkConfigSchema>();

export function registerLeadSinkKind<T>(
  kind: string,
  schema: LeadSinkConfigSchema<T>,
): void {
  registry.set(kind, schema);
}

export function clearLeadSinkKindsForTests(): void {
  registry.clear();
}

export function parseLeadSinkConfig(kind: string, raw: unknown): unknown {
  const schema = registry.get(kind);
  if (!schema) {
    throw new Error(`Unknown lead sink kind: "${kind}"`);
  }
  return schema.parse(raw);
}

export function serializeLeadSinkConfig(kind: string, config: unknown): string {
  parseLeadSinkConfig(kind, config);
  return JSON.stringify(config);
}

export function isKnownLeadSinkKind(kind: string): boolean {
  return registry.has(kind);
}
