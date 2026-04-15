import type { Difficulty } from "../hooks/useExerciseAnalyzer";
import type { WorkoutState } from "../hooks/useWorkoutEngine";
import type { Exercise } from "../types/workout";

/*
 * AI ASSISTANCE DISCLOSURE 
 *
 * The layout and styling of this component were developed with AI assistance.
 *
 * Prompt used:
 * - "Create a stats panel component that shows tracking status, rep count,
 *    angle, form score with a colour-coded bar, difficulty badge, and
 *    feedback text"
 *
 * Adaptations: The colour scheme was adjusted to match the application's
 * dark theme. The display logic for plank hold time vs rep count vs rest
 * timer was added manually to handle the three different workout states.
 */


type Props = {
  exercise: Exercise;
  state: WorkoutState;
  difficulty: Difficulty;
  reps: number;
  sets: number;
  targetReps: number;
  angle: number;
  plankTime: number;
  plankTarget: number;
  restTime: number;
  formScore: number;
  feedback: string;
  inView: boolean;
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: "#22c55e",
  moderate: "#f59e0b",
  hard: "#ef4444",
};

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "EASY",
  moderate: "MODERATE",
  hard: "HARD",
};

export default function StatsPanel({
  exercise,
  state,
  difficulty,
  reps,
  sets,
  targetReps,
  angle,
  plankTime,
  plankTarget,
  restTime,
  formScore,
  feedback,
  inView,
}: Props) {
  const isPlank = exercise === "plank";

  return (
    <div style={card}>
      {/* Status indicator */}
      <div style={statusRow}>
        <span style={dot(inView ? "#22c55e" : "#ef4444")} />
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          {!inView ? "Step into frame" : state === "idle" ? "Press Start" : "Tracking"}
        </span>
      </div>

      {/* Main metric */}
      <div style={mainMetric}>
        {state === "resting" ? (
          <>
            <div style={metricLabel}>REST</div>
            <div style={metricValue}>{restTime}s</div>
          </>
        ) : isPlank ? (
          <>
            <div style={metricLabel}>HOLD</div>
            <div style={metricValue}>
              {plankTime.toFixed(1)}
              <span style={metricUnit}>/ {plankTarget}s</span>
            </div>
          </>
        ) : (
          <>
            <div style={metricLabel}>SET {sets}</div>
            <div style={metricValue}>
              {reps}
              <span style={metricUnit}>/ {targetReps}</span>
            </div>
          </>
        )}
      </div>

      {/* Angle */}
      <div style={row}>
        <span style={rowLabel}>Angle</span>
        <span style={rowValue}>{angle.toFixed(0)}°</span>
      </div>

      {/* Form score bar */}
      <div style={row}>
        <span style={rowLabel}>Form</span>
        <span style={rowValue}>{formScore}%</span>
      </div>
      <div style={barTrack}>
        <div
          style={{
            ...barFill,
            width: `${formScore}%`,
            background:
              formScore > 80
                ? "#22c55e"
                : formScore > 60
                ? "#f59e0b"
                : "#ef4444",
          }}
        />
      </div>

      {/* Difficulty badge */}
      <div
        style={{
          ...badge,
          background: DIFFICULTY_COLORS[difficulty],
        }}
      >
        {DIFFICULTY_LABELS[difficulty]}
      </div>

      {/* Feedback */}
      <p style={feedbackText}>{feedback}</p>
    </div>
  );
}

/*  STYLES */

const card: React.CSSProperties = {
  width: 260,
  background: "#1e293b",
  padding: 20,
  borderRadius: 16,
  color: "white",
  border: "1px solid rgba(148,163,184,0.2)",
};

const statusRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 16,
};

const dot = (color: string): React.CSSProperties => ({
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: color,
  flexShrink: 0,
});

const mainMetric: React.CSSProperties = {
  marginBottom: 16,
};

const metricLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  opacity: 0.6,
  marginBottom: 4,
};

const metricValue: React.CSSProperties = {
  fontSize: 36,
  fontWeight: 800,
  lineHeight: 1,
};

const metricUnit: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 400,
  opacity: 0.5,
  marginLeft: 4,
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 4,
};

const rowLabel: React.CSSProperties = {
  fontSize: 13,
  opacity: 0.6,
};

const rowValue: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
};

const barTrack: React.CSSProperties = {
  width: "100%",
  height: 6,
  borderRadius: 3,
  background: "rgba(148,163,184,0.15)",
  marginBottom: 14,
  marginTop: 4,
};

const barFill: React.CSSProperties = {
  height: "100%",
  borderRadius: 3,
  transition: "width 0.3s ease",
};

const badge: React.CSSProperties = {
  padding: "6px 0",
  borderRadius: 8,
  fontWeight: 700,
  fontSize: 13,
  textAlign: "center",
  letterSpacing: 1,
  marginBottom: 10,
};

const feedbackText: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  opacity: 0.85,
};