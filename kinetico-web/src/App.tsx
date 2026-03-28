import { useEffect, useRef, useState } from "react";
import CameraView from "./components/CameraView";
import StatsPanel from "./components/StatsPanel";
import WorkoutHistory from "./components/WorkoutHistory";
import WorkoutSummaryModal from "./components/WorkoutSummaryModal";
import { usePoseEngine } from "./hooks/usePoseEngine";
import { useExerciseAnalyzer } from "./hooks/useExerciseAnalyzer";
import { useWorkoutEngine } from "./hooks/useWorkoutEngine";
import { useVoiceCoach } from "./hooks/useVoiceCoach";
import type { Exercise } from "./types/workout";

export default function App() {
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [running, setRunning] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // ── layer 1: vision ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const { landmarks } = usePoseEngine(videoRef, running);

  // ── layer 2 + 3: analysis + engine ──
  const engine = useWorkoutEngine(exercise);
  const analyzer = useExerciseAnalyzer(engine.difficulty);
  const { speak, resetVoiceMemory } = useVoiceCoach(voiceEnabled);

  // ── analysis (recomputed each render) ──
  const analysis = analyzer.analyze(landmarks, exercise);

  // ── auto-start when user is in view ──
  useEffect(() => {
    if (analysis.inView && engine.state === "idle") {
      engine.startWorkout();
      speak("Go!");
    }
  }, [analysis.inView, engine.state]);

  // ── feed analysis → engine each frame ──
  const prevLandmarksRef = useRef(landmarks);

  useEffect(() => {
    if (landmarks === prevLandmarksRef.current) return;
    prevLandmarksRef.current = landmarks;

    if (!analysis.inView) return;

    engine.processFrame(analysis.angle, analysis.formScore, analysis.formIssues);
  }, [landmarks, analysis, engine.processFrame]);

  // ── auto-detect exercise ──
  const prevDetectedRef = useRef<Exercise | null>(null);

  useEffect(() => {
    if (
      analysis.detectedExercise &&
      analysis.detectedExercise !== prevDetectedRef.current
    ) {
      prevDetectedRef.current = analysis.detectedExercise;

      if (analysis.detectedExercise !== exercise) {
        speak(`Detected ${analysis.detectedExercise}`);
        setExercise(analysis.detectedExercise);
      }
    }
  }, [analysis.detectedExercise]);

  // ── voice: form issues ──
  const prevFeedbackRef = useRef("Ready");

  useEffect(() => {
    if (engine.feedback !== prevFeedbackRef.current) {
      prevFeedbackRef.current = engine.feedback;
      if (engine.feedback !== "Good form") {
        speak(engine.feedback);
      }
    }
  }, [engine.feedback]);

  // ── voice: rep count + pause detection after rep ──
  const prevRepsRef = useRef(0);

  useEffect(() => {
    if (engine.reps > prevRepsRef.current && engine.reps > 0) {
      if (engine.feedback === "Good form") {
        speak(String(engine.reps));
      }
      // prevent exercise switch right after a rep
      analyzer.pauseDetection();
    }
    prevRepsRef.current = engine.reps;
  }, [engine.reps]);

  // ── voice: state transitions ──
  useEffect(() => {
    if (engine.state === "resting") speak("Set complete. Rest.");
    if (engine.state === "completed") speak("Workout complete!");
  }, [engine.state]);

  // ── handlers ──

  function handlePauseResume() {
    setRunning((r) => !r);
  }

  function handleExerciseChange(ex: Exercise) {
    setExercise(ex);
    analyzer.reset();
    resetVoiceMemory();
  }

  function handleSummaryClose() {
    engine.resetWorkout();
    analyzer.reset();
    resetVoiceMemory();
  }

  // ── derived ──

  const title =
    exercise === "squat"
      ? "Squat Coach"
      : exercise === "pushup"
      ? "Push-up Coach"
      : "Plank Coach";

  return (
    <div style={styles.page}>
      {/* ─── HEADER ─── */}
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
            <span style={styles.dot(analysis.inView ? "good" : "bad")} />
            {analysis.inView ? "In view" : "Out of view"}
          </div>

          <div style={styles.chip}>
            <span
              style={styles.dot(
                engine.state === "active" && running ? "good" : "warn"
              )}
            />
            {engine.state === "idle"
              ? "Ready"
              : engine.state === "resting"
              ? "Resting"
              : engine.state === "completed"
              ? "Done"
              : running
              ? "Running"
              : "Paused"}
          </div>

          <button
            style={{
              ...styles.btn,
              ...(voiceEnabled ? styles.btnOn : styles.btnOff),
            }}
            onClick={() => setVoiceEnabled((v) => !v)}
          >
            {voiceEnabled ? "🔊 Voice" : "🔇 Muted"}
          </button>
        </div>
      </header>

      {/* ─── MAIN ─── */}
      <main style={styles.main}>
        <section style={styles.left}>
          <div style={styles.card}>
            <div style={styles.cardTop}>
              <div style={styles.cardTitle}>{title}</div>

              <div style={{ display: "flex", gap: 10 }}>
                {(["squat", "pushup", "plank"] as Exercise[]).map((ex) => (
                  <button
                    key={ex}
                    style={{
                      ...styles.pill,
                      ...(exercise === ex ? styles.pillActive : {}),
                    }}
                    onClick={() => handleExerciseChange(ex)}
                  >
                    {ex === "pushup"
                      ? "Push-up"
                      : ex.charAt(0).toUpperCase() + ex.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div style={styles.cameraWrap}>
              <CameraView ref={videoRef} />
            </div>

            <div style={styles.controls}>
              <button
                style={{
                  ...styles.btn,
                  ...(running ? styles.btnOn : styles.btnOff),
                }}
                onClick={handlePauseResume}
              >
                {running ? "⏸ Pause" : "▶ Resume"}
              </button>
            </div>
          </div>
        </section>

        <aside style={styles.right}>
          <StatsPanel
            exercise={exercise}
            state={engine.state}
            difficulty={engine.difficulty}
            reps={engine.reps}
            sets={engine.sets}
            targetReps={engine.profile.repsPerSet}
            angle={analysis.angle}
            plankTime={engine.plankTime}
            plankTarget={engine.profile.plankSeconds}
            restTime={engine.restTime}
            formScore={analysis.formScore}
            feedback={engine.feedback}
            inView={analysis.inView}
          />
          <WorkoutHistory />
        </aside>
      </main>

      {/* ─── SUMMARY MODAL ─── */}
      {engine.summary && (
        <WorkoutSummaryModal
          summary={engine.summary}
          onClose={handleSummaryClose}
        />
      )}

      {/* ─── FOOTER ─── */}
      <footer style={styles.footer}>
        © {new Date().getFullYear()} Kinetico · Built with MediaPipe Pose
      </footer>
    </div>
  );
}

/* ─── STYLES ─── */

const styles: Record<string, any> = {
  page: {
    minHeight: "100vh",
    background: "#0b1220",
    color: "#e5e7eb",
    fontFamily:
      "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
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
      kind === "good" ? "#00ff88" : kind === "warn" ? "#fbbf24" : "#ff6b6b",
  }),
  main: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: 20,
    padding: 20,
  },
  left: {},
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
  pillActive: { background: "#1e40af" },
  cameraWrap: { padding: 16 },
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
  btnOn: { background: "#1e40af" },
  btnOff: { opacity: 0.8 },
  footer: {
    padding: 16,
    textAlign: "center",
    borderTop: "1px solid rgba(148,163,184,0.12)",
  },
};