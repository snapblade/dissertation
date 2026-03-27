import type { CoachStats } from "./CameraView";

type Props = CoachStats;

export default function StatsPanel({
  reps,
  sets,
  angle,
  feedback,
  plankTime,
  exercise,
  inView,
  formScore,
  difficulty,
  resting,
  restTime
}: Props) {

  const isPlank = exercise === "plank";

  const difficultyColor =
    difficulty === "advanced"
      ? "#ef4444"
      : difficulty === "hard"
      ? "#f97316"
      : difficulty === "moderate"
      ? "#fbbf24"
      : "#22c55e";

  return (
    <div
      style={{
        width: 260,
        background: "#1e293b",
        padding: 20,
        borderRadius: 16,
        color: "white",
        border: "1px solid rgba(148,163,184,0.2)"
      }}
    >
      <h2>
  {resting
    ? `Rest: ${restTime}s`
    : isPlank
    ? `Hold: ${plankTime.toFixed(1)}s`
    : `Set ${sets} • Reps: ${reps}`}
</h2>

      <p>Angle: {angle.toFixed(0)}°</p>

      <div
        style={{
          marginTop: 10,
          padding: "6px 10px",
          borderRadius: 8,
          background: difficultyColor,
          fontWeight: 700,
          textAlign: "center"
        }}
      >
        {difficulty?.toUpperCase()}
      </div>

      <p style={{ marginTop: 10 }}>{feedback}</p>
    </div>
  );
}