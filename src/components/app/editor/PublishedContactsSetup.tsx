"use client";

import { Button } from "@/components/ui/Button";
import {
  CheckIcon,
  ContactCardIcon,
  GoogleGIcon,
} from "@/components/app/icons/AppIcons";
import type { ContactsSetupUi } from "@/app-api/types";

export type ContactsSetupPhase = "default" | "working" | "success";

type PublishedContactsSetupProps = {
  setup: ContactsSetupUi;
  phase: ContactsSetupPhase;
  onContinueGoogle: () => void;
  onAddAddress: () => void;
};

export function PublishedContactsSetup({
  setup,
  phase,
  onContinueGoogle,
  onAddAddress,
}: PublishedContactsSetupProps) {
  if (phase === "working") {
    return (
      <section
        className="ap-rise flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4"
        aria-label="Add We Met to my contacts"
        aria-live="polite"
      >
        <div className="flex items-start gap-3" role="status">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink"
            aria-hidden
          >
            <span className="h-5 w-5 motion-reduce:animate-none motion-safe:animate-spin rounded-full border-2 border-line border-t-ink" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-ink">
              Adding We Met to your contacts
            </h3>
            <p className="mt-1 text-sm leading-[1.45] text-ink-muted">
              Saving both sending addresses to one contact. This takes a few seconds.
            </p>
          </div>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
          <div className="ap-contacts-progress-fill h-full w-1/3 rounded-full bg-ink" />
        </div>
      </section>
    );
  }

  if (phase === "success") {
    return (
      <section
        className="ap-rise flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4"
        aria-label="Add We Met to my contacts"
        aria-live="polite"
      >
        <div className="flex items-start gap-3" role="status">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink"
            aria-hidden
          >
            <CheckIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-ink">
              You&apos;re all set
            </h3>
            <p className="mt-1 text-sm leading-[1.45] text-ink-muted">
              We Met is in your Google Contacts with both addresses. This step
              won&apos;t show again.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (!setup.visible) {
    return null;
  }

  if (setup.variant === "reappear") {
    return (
      <section
        className="ap-rise flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4"
        aria-label="Add We Met to my contacts"
      >
        <div className="flex items-start gap-3">
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink"
            aria-hidden
          >
            <ContactCardIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold leading-snug text-ink">
              We added a new sending address
            </h3>
            <p className="mt-1 text-sm leading-[1.45] text-ink-muted">
              Follow-ups can now also come from{" "}
              <b className="font-medium text-ink">{setup.newSenderAddress}</b>. Add it
              to your We Met contact.
            </p>
          </div>
        </div>
        <Button
          type="button"
          className="min-h-11 w-full text-[15px]"
          onClick={onAddAddress}
        >
          Add to my We Met contact
        </Button>
      </section>
    );
  }

  return (
    <section
      className="ap-rise flex flex-col gap-3.5 rounded-lg border border-line bg-surface p-4"
      aria-label="Add We Met to my contacts"
    >
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink"
          aria-hidden
        >
          <ContactCardIcon size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-ink">
            Add We Met to my contacts
          </h3>
          <p className="mt-1 text-sm leading-[1.45] text-ink-muted">
            Follow-ups from people you meet come from We Met. Saving us as one contact
            keeps them out of Spam.
          </p>
        </div>
      </div>
      <button
        type="button"
        className="ap-contacts-google flex h-10 w-full items-center justify-center gap-2.5 rounded-pill border border-[var(--google-line)] bg-[var(--google-bg)] text-sm font-medium leading-5 tracking-[0.25px] text-[var(--google-ink)] transition-colors hover:bg-[color-mix(in_srgb,var(--google-bg)_92%,var(--google-ink)_8%)] active:bg-[color-mix(in_srgb,var(--google-bg)_88%,var(--google-ink)_12%)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-accent"
        onClick={onContinueGoogle}
      >
        <GoogleGIcon size={18} />
        <span>Continue with Google</span>
      </button>
      <p className="-mt-1 text-center text-xs leading-[1.45] text-ink-muted">
        Google asks once. We only create or update the We Met contact.
      </p>
    </section>
  );
}
