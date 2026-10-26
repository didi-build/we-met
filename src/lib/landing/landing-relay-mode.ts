/** Until DIDI-831 ships the owner direct-mode setting. */
export const SHOW_DIRECT_COMING_SOON = true;

export type FollowUpMode = "relay" | "direct";

export const LANDING_RELAY_COPY = {
  heroLead:
    "Share one link or QR code. They save your card on the spot, and you get a follow-up letter ready to send, plus all their details, in your inbox.",
  step2Body:
    "The person you met taps Exchange contact, adds their name and email, and saves your contact card on the spot.",
  step3TitleRelay: "Two emails land in your inbox",
  step3BodyRelay:
    "A \u201cGreat meeting you\u201d letter for them, ready to send on, and a \u201cYou met\u201d email with every detail they shared, just for you.",
  step3ChipRelay: "You choose when the letter goes",
  step3TitleDirect: "Your copy lands in your inbox",
  step3BodyDirect:
    "The \u201cGreat meeting you\u201d letter goes straight to them. Your copy, \u201cYou met\u201d, comes to you with every detail they shared.",
  replyNote:
    "To send it on, just hit Reply. When you hit Reply, they can save your contact card.",
  nothingNote:
    "We Met sends them nothing, so the letter waits for you until you send it on.",
  directLine:
    "Prefer it automatic? Switch to direct and the letter goes straight to them.",
  directStateLine:
    "Direct mode: the letter goes directly to their inbox, and you still get \u201cYou met\u201d with all the details.",
  comingSoonBadge: "Coming soon",
} as const;
