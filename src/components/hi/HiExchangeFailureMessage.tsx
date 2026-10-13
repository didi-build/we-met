import type { CardCopyExchangeSheet } from "@/card-data/types";

type HiExchangeFailureMessageProps = {
  copy: CardCopyExchangeSheet;
  variant?: "server" | "network";
};

export function HiExchangeFailureMessage({
  copy,
  variant = "server",
}: HiExchangeFailureMessageProps) {
  if (variant === "network") {
    return (
      <p role="alert" className="m-0 text-[15px] font-medium text-error">
        {copy.networkErrorMessage}
      </p>
    );
  }

  return (
    <p role="alert" className="m-0 text-[15px] font-medium text-error">
      {copy.exchangeNotSavedPrefix}
      <a
        href={`mailto:${copy.exchangeNotSavedEmail}`}
        className="text-error underline decoration-1 underline-offset-2"
      >
        {copy.exchangeNotSavedEmail}
      </a>
      {copy.exchangeNotSavedSuffix}
    </p>
  );
}
