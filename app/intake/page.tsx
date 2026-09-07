import { StageBoard } from "@/components/StageBoard";
import { NewBikeForm } from "@/components/NewBikeForm";

export default function Page() {
  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Intake</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        Assign a stock number to a newly purchased bike. This number follows it everywhere from here on.
      </p>
      <NewBikeForm />
      <StageBoard status="intake" title="Awaiting teardown" />
    </div>
  );
}
