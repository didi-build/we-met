"use client";

import { FollowUpModeSwitch } from "@/components/landing/FollowUpModeSwitch";
import { HOW_IT_WORKS_INTERSECTION_OPTIONS } from "@/components/landing/how-it-works-observer";
import {
  HOW_IT_WORKS_STEPS,
  type HowItWorksStep,
} from "@/components/landing/how-it-works-steps";
import { FollowUpInboxVignette } from "@/components/landing/HowItWorksVignettes";
import { ReplyIcon } from "@/components/landing/LandingIcons";
import {
  LANDING_RELAY_COPY,
  SHOW_DIRECT_COMING_SOON,
  type FollowUpMode,
} from "@/lib/landing/landing-relay-mode";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";

function buildStepThree(
  mode: FollowUpMode,
  setFollowUpMode: Dispatch<SetStateAction<FollowUpMode>>,
): HowItWorksStep {
  const isDirect = mode === "direct";
  return {
    title: isDirect
      ? LANDING_RELAY_COPY.step3TitleDirect
      : LANDING_RELAY_COPY.step3TitleRelay,
    body: isDirect
      ? LANDING_RELAY_COPY.step3BodyDirect
      : LANDING_RELAY_COPY.step3BodyRelay,
    chip: isDirect ? undefined : LANDING_RELAY_COPY.step3ChipRelay,
    chipSlot: isDirect ? (
      SHOW_DIRECT_COMING_SOON ? (
        <span className="lp-chip" data-slot="direct-coming-soon">
          {LANDING_RELAY_COPY.comingSoonBadge}
        </span>
      ) : null
    ) : undefined,
    vignettes: [<FollowUpInboxVignette key={`inbox-${mode}`} mode={mode} />],
    extra: (
      <div className="lp-notes">
        {mode === "relay" ? (
          <>
            <p className="lp-note">
              <span className="lp-dot" aria-hidden="true">
                <ReplyIcon size={10} />
              </span>
              <span>{LANDING_RELAY_COPY.replyNote}</span>
            </p>
            <p className="lp-note">
              <span className="lp-dot" aria-hidden="true">
                i
              </span>
              <span>{LANDING_RELAY_COPY.nothingNote}</span>
            </p>
            <p className="lp-note">
              <span className="lp-dot" aria-hidden="true">
                i
              </span>
              <span>{LANDING_RELAY_COPY.directLine}</span>
            </p>
          </>
        ) : (
          <p className="lp-note">
            <span className="lp-dot" aria-hidden="true">
              i
            </span>
            <span>{LANDING_RELAY_COPY.directStateLine}</span>
          </p>
        )}
        <FollowUpModeSwitch mode={mode} onChange={setFollowUpMode} small />
      </div>
    ),
  };
}

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const [followUpMode, setFollowUpMode] = useState<FollowUpMode>("relay");
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  const steps = useMemo(
    () => [...HOW_IT_WORKS_STEPS, buildStepThree(followUpMode, setFollowUpMode)],
    [followUpMode],
  );

  useEffect(() => {
    const stepElements = stepRefs.current.filter(Boolean) as HTMLLIElement[];
    if (stepElements.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const index = stepElements.indexOf(entry.target as HTMLLIElement);
          if (index >= 0) setActiveStep(index);
        }
      }
    }, HOW_IT_WORKS_INTERSECTION_OPTIONS);

    for (const step of stepElements) observer.observe(step);
    return () => observer.disconnect();
  }, [steps.length]);

  return (
    <section className="lp-band" aria-labelledby="how-title">
      <div className="lp-wrap lp-how">
        <div className="lp-sechead">
          <p className="lp-eyebrow">How it works</p>
          <h2 className="lp-h2" id="how-title">
            Three steps, from hello to follow-up.
          </h2>
          <p className="lp-body">
            Free to start, with nothing to install on either side.
          </p>
        </div>
        <div className="lp-how-grid">
          <div className="lp-panel" aria-hidden="true">
            {steps.map((step, index) => (
              <div
                key={`${step.title}-${index}`}
                className="lp-layer"
                data-layer={index}
                data-active={index === activeStep ? "true" : "false"}
              >
                {step.vignettes}
              </div>
            ))}
          </div>
          <ol className="lp-steps">
            {steps.map((step, index) => (
              <li
                key={`${step.title}-${index}`}
                className="lp-step"
                data-step={index}
                data-active={index === activeStep ? "true" : "false"}
                ref={(el) => {
                  stepRefs.current[index] = el;
                }}
              >
                <span className="lp-num" aria-hidden="true">
                  {index + 1}
                </span>
                <h3>{step.title}</h3>
                <p className="lp-body">{step.body}</p>
                {step.chipSlot !== undefined ? (
                  <ul className="lp-chips">
                    <li className="lp-chip-slot">{step.chipSlot}</li>
                  </ul>
                ) : step.chip ? (
                  <ul className="lp-chips">
                    <li>
                      <span className="lp-chip">{step.chip}</span>
                    </li>
                  </ul>
                ) : null}
                {step.extra}
                <div className="lp-vig-box" aria-hidden="true">
                  {step.vignettes}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
