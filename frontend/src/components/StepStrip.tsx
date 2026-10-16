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
  const steps: { id: Step; label: string }[] = [
    { id: "profile", label: "1 · Profile" },
    { id: "photo", label: "2 · Photos" },
    { id: "results", label: "3 · Results" },
  ];
  const order: Step[] = ["profile", "photo", "results"];

  return (
    <nav className="step-strip" aria-label="Steps">
      <ol>
        {steps.map(({ id, label }) => {
          const reachable = order.indexOf(id) <= order.indexOf(maxReached);
          const isCurrent = id === current;
          return (
            <li key={id} aria-current={isCurrent ? "step" : undefined}>
              {reachable ? (
                <button
                  type="button"
                  className={`step-chip ${isCurrent ? "step-current" : ""}`}
                  onClick={() => onGo(id)}
                >
                  {label}
                </button>
              ) : (
                <span className="step-chip step-locked">{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
