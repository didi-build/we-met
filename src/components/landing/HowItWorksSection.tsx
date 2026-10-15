"use client";

import { HOW_IT_WORKS_INTERSECTION_OPTIONS } from "@/components/landing/how-it-works-observer";
import { HOW_IT_WORKS_STEPS } from "@/components/landing/how-it-works-steps";
import { useEffect, useRef, useState } from "react";

export function HowItWorksSection() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const steps = stepRefs.current.filter(Boolean) as HTMLLIElement[];
    if (steps.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const index = steps.indexOf(entry.target as HTMLLIElement);
          if (index >= 0) setActiveStep(index);
        }
      }
    }, HOW_IT_WORKS_INTERSECTION_OPTIONS);

    for (const step of steps) observer.observe(step);
    return () => observer.disconnect();
  }, []);

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
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <div
                key={step.title}
                className="lp-layer"
                data-layer={index}
                data-active={index === activeStep ? "true" : "false"}
              >
                {step.vignettes}
              </div>
            ))}
          </div>
          <ol className="lp-steps">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <li
                key={step.title}
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
                <ul className="lp-chips">
                  <li>
                    <span className="lp-chip">{step.chip}</span>
                  </li>
                </ul>
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
