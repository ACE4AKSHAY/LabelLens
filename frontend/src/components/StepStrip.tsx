// StepStrip (Section 9): Profile → Photo → Results, with the current step
// highlighted. Buttons let the user move between completed steps.

export type Step = "profile" | "photo" | "results";

export function StepStrip({
  current,
  maxReached,
  onGo,
}: {
  current: Step;
  maxReached: Step;
  onGo: (step: Step) => void;
}) {
  const steps: { id: Step; num: string; label: string }[] = [
    { id: "profile", num: "1", label: "Profile" },
    { id: "photo", num: "2", label: "Photos" },
    { id: "results", num: "3", label: "Results" },
  ];
  const order: Step[] = ["profile", "photo", "results"];

  return (
    <nav className="step-strip" aria-label="Steps">
      <ol>
        {steps.map(({ id, num, label }) => {
          const reachable = order.indexOf(id) <= order.indexOf(maxReached);
          const isCurrent = id === current;
          const isDone = order.indexOf(id) < order.indexOf(current);
          const inner = (
            <>
              <b className="step-num" aria-hidden="true">{num}</b>
              {label}
            </>
          );
          return (
            <li
              key={id}
              className={isDone ? "step-done" : undefined}
              aria-current={isCurrent ? "step" : undefined}
            >
              {reachable ? (
                <button
                  type="button"
                  className={`step-chip ${isCurrent ? "step-current" : ""}`}
                  onClick={() => onGo(id)}
                >
                  {inner}
                </button>
              ) : (
                <span className="step-chip step-locked">{inner}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
