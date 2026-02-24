export default function StatsPanel({
  reps,
  angle,
  feedback,
  plankTime,
  isPlank
}: any) {
  return (
    <div
      style={{
        width: 220,
        background: "#1e293b",
        padding: 20,
        borderRadius: 12,
        color: "white"
      }}
    >
      <h2>{isPlank ? `Hold: ${plankTime?.toFixed(1)}s` : `Reps: ${reps}`}</h2>
      <p>Angle: {angle?.toFixed(0)}°</p>
      <p style={{ color: "#00ff88", fontWeight: 600 }}>{feedback}</p>
    </div>
  );
}
