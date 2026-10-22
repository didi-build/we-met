const SUBJECTS = [
  "Quick check-in",
  "Warm-up ping",
  "Mailbox probe",
  "Delivery test",
  "Short note",
  "Status pulse",
  "Inbox hello",
  "Routine signal",
  "Seed touchpoint",
  "Lightweight test",
];

const BODY_LINES = [
  "This is a short warm-up message.",
  "Checking that delivery still looks healthy.",
  "No action needed on your side.",
  "Thanks for helping keep the lane warm.",
  "A brief note from the warm-up worker.",
  "Randomized copy to vary content over time.",
  "Hope your inbox is having a good day.",
  "Another small message in the rotation.",
];

export type WarmupContent = {
  subject: string;
  text: string;
  html: string;
};

function pick<T>(items: readonly T[], randomUnit: number): T {
  const index = Math.min(items.length - 1, Math.floor(randomUnit * items.length));
  return items[index];
}

export function buildWarmupContent(randomUnit: number): WarmupContent {
  const subject = pick(SUBJECTS, randomUnit);
  const lineA = pick(BODY_LINES, (randomUnit * 0.37) % 1);
  const lineB = pick(BODY_LINES, (randomUnit * 0.91) % 1);
  const text = `${lineA} ${lineB}`;
  const html = `<p>${lineA}</p><p>${lineB}</p>`;
  return { subject, text, html };
}

export function pickSeedRecipient(
  seeds: readonly string[],
  randomUnit: number,
): string {
  if (seeds.length === 0) {
    throw new Error("pickSeedRecipient requires at least one seed");
  }
  const index = Math.min(seeds.length - 1, Math.floor(randomUnit * seeds.length));
  return seeds[index];
}
