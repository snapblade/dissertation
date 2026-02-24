import { useMemo, useState } from "react";
import CameraView, { type CoachStats, type Exercise } from "./components/CameraView";

export default function App() {
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [running, setRunning] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [stats, setStats] = useState<CoachStats>({
    exercise: "squat",
    reps: 0,
    angle: 0,
    plankTime: 0,
    feedback: "Ready",
    inView: true,
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
            title="Toggle voice feedback"
          >
            {voiceEnabled ? "🔊 Voice On" : "🔇 Voice Off"}
          </button>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.left}>
          <div style={styles.card}>
            <div style={styles.cardTop}>
              <div>
                <div style={styles.cardTitle}>{title}</div>
                <div style={styles.hint}>Keyboard: 1 Squat · 2 Push-up · 3 Plank</div>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
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

              <button
                style={styles.btn}
                onClick={() => {
                  // “Reset” by toggling exercise to itself triggers an internal reset in CameraView
                  setExercise(e => e);
                }}
              >
                ↺ Reset
              </button>

              <div style={styles.note}>
                Tip: stand back so hips/knees/ankles are visible. Good lighting helps.
              </div>
            </div>
          </div>
        </section>

        <aside style={styles.right}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Live Metrics</div>

            <div style={styles.grid}>
              <Metric label={stats.exercise === "plank" ? "HOLD (s)" : "REPS"} value={
                stats.exercise === "plank" ? stats.plankTime.toFixed(1) : String(stats.reps)
              } />

              <Metric label="ANGLE (°)" value={stats.angle.toFixed(0)} />

              <Metric label="EXERCISE" value={stats.exercise.toUpperCase()} />
              <Metric label="QUALITY" value={stats.inView ? "OK" : "LOW"} />
            </div>

            <div style={styles.feedbackBox}>
              <div style={styles.feedbackLabel}>Coach</div>
              <div style={{ ...styles.feedbackText, color: stats.inView ? "#00ff88" : "#ff6b6b" }}>
                {stats.feedback}
              </div>
            </div>

            <div style={styles.panelBottom}>
              <div style={styles.small}>
                Next: add auto exercise detection + session history.
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer style={styles.footer}>
        <span style={styles.small}>© {new Date().getFullYear()} Kinetico · Built with MediaPipe Pose</span>
      </footer>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>{value}</div>
    </div>
  );
}

const styles: any = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 20% 0%, rgba(56,189,248,0.12), transparent 60%), #0b1220",
    color: "#e5e7eb",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(148,163,184,0.15)",
    position: "sticky",
    top: 0,
    background: "rgba(11,18,32,0.75)",
    backdropFilter: "blur(10px)",
    zIndex: 10,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 12,
    background: "linear-gradient(135deg, rgba(34,211,238,0.35), rgba(59,130,246,0.35))",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
  },
  brand: { fontWeight: 800, letterSpacing: 0.2 },
  sub: { fontSize: 12, color: "rgba(226,232,240,0.65)", marginTop: 2 },
  headerRight: { display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  chip: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(15,23,42,0.6)",
    fontSize: 13,
  },
  dot: (kind: "good" | "bad" | "warn") => ({
    width: 8, height: 8, borderRadius: 999,
    background: kind === "good" ? "#00ff88" : kind === "warn" ? "#fbbf24" : "#ff6b6b",
    boxShadow: "0 0 0 4px rgba(0,0,0,0.15)",
  }),
  main: {
  display: "grid",
  gridTemplateColumns: "2fr 1fr",
  gap: 20,
  padding: 20,
  width: "100%",
  height: "calc(100vh - 80px)",
  boxSizing: "border-box",
},

  left: {},
  right: {
  width: "100%",
  minWidth: 0,
},
  card: {
    border: "1px solid rgba(148,163,184,0.16)",
    background: "rgba(15,23,42,0.6)",
    borderRadius: 18,
    overflow: "hidden",
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  },
  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderBottom: "1px solid rgba(148,163,184,0.12)",
  },
  cardTitle: { fontSize: 18, fontWeight: 800 },
  hint: { fontSize: 12, color: "rgba(226,232,240,0.65)", marginTop: 4 },
  pill: {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.35)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 600,
  },
  pillActive: {
    background: "linear-gradient(135deg, rgba(34,211,238,0.22), rgba(59,130,246,0.22))",
    border: "1px solid rgba(34,211,238,0.35)",
  },
  cameraWrap: {
  padding: 16,
  width: "100%",
},
  controls: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: 16,
    borderTop: "1px solid rgba(148,163,184,0.12)",
    flexWrap: "wrap",
  },
  btn: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.18)",
    background: "rgba(2,6,23,0.35)",
    color: "#e5e7eb",
    cursor: "pointer",
    fontWeight: 700,
  },
  btnOn: {
    border: "1px solid rgba(34,211,238,0.38)",
    background: "linear-gradient(135deg, rgba(34,211,238,0.20), rgba(59,130,246,0.18))",
  },
  btnOff: {
    opacity: 0.8,
  },
  note: {
    fontSize: 12,
    color: "rgba(226,232,240,0.65)",
    marginLeft: "auto",
  },
  panel: {
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.6)",
  borderRadius: 18,
  padding: 16,
  boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  width: "100%",
  boxSizing: "border-box",
},
  panelTitle: { fontWeight: 900, marginBottom: 12, fontSize: 14, letterSpacing: 0.2 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  metric: {
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(2,6,23,0.35)",
    borderRadius: 16,
    padding: 12,
  },
  metricLabel: { fontSize: 11, color: "rgba(226,232,240,0.60)", letterSpacing: 0.6 },
  metricValue: { fontSize: 22, fontWeight: 900, marginTop: 6 },
  feedbackBox: {
    marginTop: 14,
    borderRadius: 16,
    border: "1px solid rgba(148,163,184,0.14)",
    background: "rgba(2,6,23,0.35)",
    padding: 12,
  },
  feedbackLabel: { fontSize: 11, color: "rgba(226,232,240,0.60)", letterSpacing: 0.6 },
  feedbackText: { fontSize: 16, fontWeight: 800, marginTop: 6 },
  panelBottom: { marginTop: 14 },
  footer: {
    padding: 16,
    textAlign: "center",
    borderTop: "1px solid rgba(148,163,184,0.12)",
    marginTop: 18,
  },
  small: { fontSize: 12, color: "rgba(226,232,240,0.65)" },
};
