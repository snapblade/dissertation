import type { WorkoutSummary } from "../hooks/useWorkoutEngine";

/*
 * AI ASSISTANCE DISCLOSURE 
 *
 * The layout and styling of this component were developed with AI assistance.
 *
 * Prompt used:
 * - "Create a workout summary modal that shows exercise, difficulty, sets,
 *    reps, duration, and average form score"
 *
 * Adaptations: The stat rows and styling were adjusted to match the
 * application's existing design language.
 */


type Props = {
  summary: WorkoutSummary;
  onClose: () => void;
};

export default function WorkoutSummaryModal({ summary, onClose }: Props) {
  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ marginTop: 0 }}>Workout Complete</h2>

        <div style={statRow}>
          <span>Exercise</span>
          <strong>{summary.exercise.toUpperCase()}</strong>
        </div>
        <div style={statRow}>
          <span>Difficulty</span>
          <strong>{summary.difficulty.toUpperCase()}</strong>
        </div>
        <div style={statRow}>
          <span>Sets</span>
          <strong>{summary.totalSets}</strong>
        </div>
        <div style={statRow}>
          <span>Reps / Set</span>
          <strong>{summary.repsPerSet}</strong>
        </div>
        <div style={statRow}>
          <span>Total Reps</span>
          <strong>{summary.totalReps}</strong>
        </div>
        <div style={statRow}>
          <span>Duration</span>
          <strong>{summary.duration}s</strong>
        </div>
        <div style={statRow}>
          <span>Avg Form</span>
          <strong>{summary.avgFormScore}%</strong>
        </div>

        <button style={button} onClick={onClose}>
          Start New Workout
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.7)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: "#1e293b",
  padding: 30,
  borderRadius: 20,
  width: 320,
  color: "white",
  border: "1px solid rgba(148,163,184,0.3)",
};

const statRow: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 10,
};

const button: React.CSSProperties = {
  marginTop: 20,
  width: "100%",
  padding: 10,
  borderRadius: 10,
  border: "none",
  background: "#1e40af",
  color: "white",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};