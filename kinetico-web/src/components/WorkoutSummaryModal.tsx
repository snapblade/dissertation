import type { WorkoutSummary } from "../hooks/useWorkoutEngine";

type Props = {
  summary: WorkoutSummary;
  onClose: () => void;
};

export default function WorkoutSummaryModal({
  summary,
  onClose
}: Props) {

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2>Workout Complete 🎉</h2>

        <div style={statRow}>
          <span>Exercise</span>
          <strong>{summary.exercise}</strong>
        </div>

        <div style={statRow}>
          <span>Sets</span>
          <strong>{summary.totalSets}</strong>
        </div>

        <div style={statRow}>
          <span>Reps per Set</span>
          <strong>{summary.finalRepsPerSet}</strong>
        </div>

        <div style={statRow}>
          <span>Total Reps</span>
          <strong>{summary.totalReps}</strong>
        </div>

        <div style={statRow}>
          <span>Duration</span>
          <strong>{summary.duration}s</strong>
        </div>

        <button style={button} onClick={onClose}>
          Start New Workout
        </button>
      </div>
    </div>
  );
}

const overlay: any = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000
};

const modal: any = {
  background: "#1e293b",
  padding: 30,
  borderRadius: 20,
  width: 320,
  color: "white",
  border: "1px solid rgba(148,163,184,0.3)"
};

const statRow: any = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10
};

const button: any = {
  marginTop: 20,
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "#1e40af",
  color: "white",
  cursor: "pointer"
};