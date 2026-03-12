import { useMemo, useState } from "react";
import CameraView, { type CoachStats, type Exercise } from "./components/CameraView";
import StatsPanel from "./components/StatsPanel";
import WorkoutHistory from "./components/WorkoutHistory";

export default function App() {
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [running, setRunning] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  
const [stats, setStats] = useState<CoachStats>({
  exercise: "squat",
  reps: 0,
  sets: 1,
  angle: 0,
  plankTime: 0,
  feedback: "Ready",
  inView: true,
  resting: false,
  restTime: 0,
  formScore: 100,
  formIssues: [],
  primaryIssue: null,
  difficulty: "easy"
});

  const title = useMemo(() => {
    if (exercise === "squat") return "Squat Coach";
    if (exercise === "pushup") return "Push-up Coach";
    return "Plank Coach";
  }, [exercise]);

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={styles.logo}>K</div>
          <div>
            <div style={styles.brand}>Kinetico</div>
            <div style={styles.sub}>Web Pose Trainer</div>
          </div>
        </div>

        <div style={styles.headerRight}>
          <div style={styles.chip}>
            <span style={styles.dot(stats.inView ? "good" : "bad")} />
            {stats.inView ? "In view" : "Out of view"}
          </div>

          <div style={styles.chip}>
            <span style={styles.dot(running ? "good" : "warn")} />
            {running ? "Running" : "Paused"}
          </div>

          <button
            style={{ ...styles.btn, ...(voiceEnabled ? styles.btnOn : styles.btnOff) }}
            onClick={() => setVoiceEnabled(v => !v)}
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.left}>
          <div style={styles.card}>
            <div style={styles.cardTop}>
              <div style={styles.cardTitle}>{title}</div>

              <div style={{ display: "flex", gap: 10 }}>
                <button
                  style={{ ...styles.pill, ...(exercise === "squat" ? styles.pillActive : {}) }}
                  onClick={() => setExercise("squat")}
                >
                  Squat
                </button>
                <button
                  style={{ ...styles.pill, ...(exercise === "pushup" ? styles.pillActive : {}) }}
                  onClick={() => setExercise("pushup")}
                >
                  Push-up
                </button>
                <button
                  style={{ ...styles.pill, ...(exercise === "plank" ? styles.pillActive : {}) }}
                  onClick={() => setExercise("plank")}
                >
                  Plank
                </button>
              </div>
            </div>

            <div style={styles.cameraWrap}>
              <CameraView
                exercise={exercise}
                running={running}
                voiceEnabled={voiceEnabled}
                onStats={setStats}
              />
            </div>

            <div style={styles.controls}>
              <button
                style={{ ...styles.btn, ...(running ? styles.btnOn : styles.btnOff) }}
                onClick={() => setRunning(r => !r)}
              >
                {running ? "⏸ Pause" : "▶ Start"}
              </button>
            </div>
          </div>
        </section>

        <aside style={styles.right}>
          <StatsPanel {...stats} />
          <WorkoutHistory />
        </aside>
      </main>

      <footer style={styles.footer}>
        © {new Date().getFullYear()} Kinetico · Built with MediaPipe Pose
      </footer>
    </div>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(148,163,184,0.15)",
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "linear-gradient(135deg, #22d3ee55, #3b82f655)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  brand: { fontWeight: 800 },
  sub: { fontSize: 12, opacity: 0.7 },
  headerRight: { display: "flex", alignItems: "center", gap: 10 },
  chip: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.2)",
  },
  dot: (kind: "good" | "bad" | "warn") => ({
    width: 8,
    height: 8,
    borderRadius: 999,
    background:
      kind === "good"
        ? "#00ff88"
        : kind === "warn"
        ? "#fbbf24"
        : "#ff6b6b",
  }),
  main: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20,
    padding: 20,
  },
  right: {
    width: "100%",
    maxHeight: "calc(100vh - 120px)",
    overflowY: "auto",
    paddingRight: 8,
  },
  card: {
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.6)",
    borderRadius: 18,
    overflow: "hidden",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    padding: 16,
  },
  cardTitle: { fontSize: 18, fontWeight: 800 },
  pill: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "#111827",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  pillActive: {
    background: "#1e40af",
  },
  cameraWrap: {
    padding: 16,
  },
  controls: {
    padding: 16,
    borderTop: "1px solid rgba(148,163,184,0.12)",
  },
  btn: {
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(148,163,184,0.2)",
    background: "#111827",
    color: "#e5e7eb",
    cursor: "pointer",
  },
  btnOn: {
    background: "#1e40af",
  },
  btnOff: {
    opacity: 0.8,
  },
  footer: {
    padding: 16,
    textAlign: "center",
    borderTop: "1px solid rgba(148,163,184,0.12)",
  },
};
