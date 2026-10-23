import { firstNameFromFullName } from "@/lib/hi-card/card-content";

export function sentToOwnerLabel(ownerName: string): string {
  const first = firstNameFromFullName(ownerName);
  return `Sent to ${first}`;
}

export function saveOwnerContactLabel(ownerName: string): string {
  const first = firstNameFromFullName(ownerName);
  return `Save ${first}'s contact`;
}

export function ownerFollowUpLine(ownerName: string): string {
  const first = firstNameFromFullName(ownerName);
  return `${first} will follow up by email.`;
}

export function tellOwnerMoreLabel(ownerName: string): string {
  const first = firstNameFromFullName(ownerName);
  return `Tell ${first} more about you`;
}

export function detailsAddedThanks(visitorFirstName: string): string {
  const first = visitorFirstName.trim() || "there";
  return `Your details were added. Thanks, ${first}.`;
}

export function reloadFallbackLine(ownerName: string): string {
  const first = firstNameFromFullName(ownerName);
  return `${first} has your details and will follow up by email.`;
}
