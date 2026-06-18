import { CheckCircle } from "lucide-react";

import { STEPS, type Step } from "./types";

interface CheckoutStepperProps {
  step: Step;
  onStepChange: (step: Step) => void;
}

const STEP_ORDER: Step[] = ["address", "shipping", "payment", "review", "success"];

/**
 * Accessible checkout progress indicator.
 *
 * - Uses a semantic `<ol>` so screen readers announce "list of 4 items".
 * - The active item carries `aria-current="step"` (WAI-ARIA breadcrumb pattern).
 * - Completed items are real `<a href>` so they are tab-focusable and respond
 *   to Enter/Space; clicking them jumps back to that step (allowed flow).
 * - Future items are rendered as inert `<span>` (not focusable, not clickable)
 *   so the keyboard tab order stays clean.
 * - Every focusable node has a `focus-visible:ring-2` indicator so the user
 *   always sees where focus is.
 */
export function CheckoutStepper({ step, onStepChange }: CheckoutStepperProps) {
  const stepIdx = STEP_ORDER.indexOf(step);

  return (
    <ol className="flex items-center justify-center mb-10">
      {STEPS.map((s, i) => {
        const isActive = s.id === step;
        const isDone = STEP_ORDER.indexOf(s.id) < stepIdx;
        const StepIcon = s.icon;
        return (
          <li key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              {isDone ? (
                <a
                  href={`#step-${s.id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onStepChange(s.id);
                  }}
                  aria-label={s.labelKey}
                  data-step-id={s.id}
                  data-step-state="done"
                  className={[
                    "w-[34px] h-[34px] rounded-full border-2 flex items-center justify-center transition-all duration-300",
                    "bg-primary border-primary text-white cursor-pointer hover:opacity-80",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  ].join(" ")}
                >
                  <CheckCircle size={16} />
                </a>
              ) : (
                <span
                  aria-label={s.labelKey}
                  aria-current={isActive ? "step" : undefined}
                  aria-disabled={!isActive}
                  data-step-id={s.id}
                  data-step-state={isActive ? "active" : "future"}
                  className={[
                    "w-[34px] h-[34px] rounded-full border-2 flex items-center justify-center transition-all duration-300",
                    isActive
                      ? "border-primary text-primary bg-primary-light scale-110"
                      : "border-border text-muted-foreground bg-card",
                    isActive
                      ? "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      : "",
                  ].join(" ")}
                >
                  <StepIcon size={16} />
                </span>
              )}
              <span
                className={[
                  "text-xs mt-1 font-medium",
                  isActive ? "text-foreground" : isDone ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                {s.labelKey}
              </span>
            </div>
            {i < STEPS.length - 1 ? (
              <div
                className={[
                  "w-12 h-0.5 mb-5 mx-1 transition-colors",
                  isDone ? "bg-primary" : "bg-border",
                ].join(" ")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
