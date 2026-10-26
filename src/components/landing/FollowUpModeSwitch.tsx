import type { FollowUpMode } from "@/lib/landing/landing-relay-mode";

type FollowUpModeSwitchProps = {
  mode: FollowUpMode;
  onChange: (mode: FollowUpMode) => void;
  small?: boolean;
};

export function FollowUpModeSwitch({ mode, onChange, small }: FollowUpModeSwitchProps) {
  return (
    <div
      className={`lp-mode${small ? " lp-mode-small" : ""}`}
      role="group"
      aria-label="Follow-up mode"
    >
      <button
        type="button"
        aria-pressed={mode === "relay"}
        onClick={() => onChange("relay")}
      >
        Relay (default)
      </button>
      <button
        type="button"
        aria-pressed={mode === "direct"}
        onClick={() => onChange("direct")}
      >
        Direct
      </button>
    </div>
  );
}
