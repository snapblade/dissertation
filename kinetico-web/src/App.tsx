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

/*
 * AI ASSISTANCE DISCLOSURE (AIAS Level 4)
 *
 * The page layout, header, and styling in this file were developed with
 * AI assistance.
 *
 * Prompt used:
 * - "Create a two-column layout with camera feed on the left and stats
 *    panel on the right, with a header showing status indicators"
 *
 * Adaptations: The orchestration logic (wiring layers together, voice
 * coaching triggers, countdown, auto-detect handling) was developed
 * iteratively through debugging and testing. The dark colour scheme
 * and responsive layout were adjusted to match usability requirements.
 */


export default function App() {
  const [exercise, setExercise] = useState<Exercise>("squat");
  const [running, setRunning] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  // layer 1: vision
  const videoRef = useRef<HTMLVideoElement>(null);
  const { landmarks } = usePoseEngine(videoRef, running);

  // layer 2 + 3: analysis + engine
  const engine = useWorkoutEngine(exercise);
  const analyzer = useExerciseAnalyzer(engine.difficulty);
  const { speak, resetVoiceMemory } = useVoiceCoach(voiceEnabled);

  // analysis (recomputed each render)
  const analysis = analyzer.analyze(landmarks, exercise);

  // auto-start with countdown when user is in view
  const countdownRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (analysis.inView && engine.state === "idle" && !countdownRef.current) {
      let remaining = 3;
      setCountdown(remaining);
      speak("Get ready", 2);

      countdownRef.current = window.setInterval(() => {
        remaining--;
        if (remaining > 0) {
          setCountdown(remaining);
          speak(String(remaining), 2);
        } else {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          setCountdown(null);
          engine.startWorkout();
          speak("Go!", 2);
        }
      }, 1000);
    }

    // cancel countdown if user leaves view
    if (!analysis.inView && countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      setCountdown(null);
    }
  }, [analysis.inView, engine.state]);

  // feed analysis → engine each frame
  const prevLandmarksRef = useRef(landmarks);

  useEffect(() => {
    if (landmarks === prevLandmarksRef.current) return;
    prevLandmarksRef.current = landmarks;

    if (!analysis.inView) return;

    engine.processFrame(analysis.angle, analysis.formScore, analysis.formIssues);

    // speak form issues — priority 1 (highest)
    if (analysis.formIssues.length > 0 && engine.state === "active") {
      speak(analysis.formIssues[0], 1);
    }
  }, [landmarks, analysis, engine.processFrame, engine.state]);

  // auto-detect exercise 
  const prevDetectedRef = useRef<Exercise | null>(null);

  useEffect(() => {
    if (
      analysis.detectedExercise &&
      analysis.detectedExercise !== prevDetectedRef.current
    ) {
      prevDetectedRef.current = analysis.detectedExercise;

      if (analysis.detectedExercise !== exercise) {
        speak(`Detected ${analysis.detectedExercise}`, 2);
        setExercise(analysis.detectedExercise);
      }
    }
  }, [analysis.detectedExercise]);

  // voice: engine feedback (e.g. "Go lower" after failed rep)
  const prevEngineFeedbackRef = useRef("Ready");

  useEffect(() => {
    if (engine.feedback !== prevEngineFeedbackRef.current) {
      if (engine.feedback === "Good form") {
        if (
          prevEngineFeedbackRef.current !== "Ready" &&
          prevEngineFeedbackRef.current !== "Good form"
        ) {
          speak("Good form", 3);
        }
        resetVoiceMemory();
      } else if (engine.feedback !== "Ready") {
        speak(engine.feedback, 1);
      }
    }
    prevEngineFeedbackRef.current = engine.feedback;
  }, [engine.feedback]);

  // voice: rep count + almost done + pause detection 
  const prevRepsRef = useRef(0);

  useEffect(() => {
    if (engine.reps > prevRepsRef.current && engine.reps > 0) {
      const remaining = engine.profile.repsPerSet - engine.reps;

      if (remaining === 2) {
        speak("Almost done", 3);
      } else if (engine.feedback === "Good form") {
        speak(String(engine.reps), 4);
      }

      analyzer.pauseDetection();
    }
    prevRepsRef.current = engine.reps;
  }, [engine.reps]);

  // voice: state transitions
  useEffect(() => {
    if (engine.state === "resting") speak("Set complete. Rest.", 2);
    if (engine.state === "completed") speak("Workout complete!", 2);
  }, [engine.state]);

  // voice: plank almost done
  const plankAlmostRef = useRef(false);

  useEffect(() => {
    const remaining = engine.profile.plankSeconds - engine.plankTime;

    if (remaining <= 3 && remaining > 0 && engine.plankTime > 0 && !plankAlmostRef.current) {
      speak("Almost done", 3);
      plankAlmostRef.current = true;
    }

    if (engine.plankTime === 0) {
      plankAlmostRef.current = false;
    }
  }, [engine.plankTime]);

  // handlers

  function handlePauseResume() {
    setRunning((r) => !r);
  }

  function handleExerciseChange(ex: Exercise) {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      setCountdown(null);
    }
    setExercise(ex);
    analyzer.reset();
    resetVoiceMemory();
  }

  function handleSummaryClose() {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
      setCountdown(null);
    }
    engine.resetWorkout();
    analyzer.reset();
    resetVoiceMemory();
  }

  // derived

  const title =
    exercise === "squat"
      ? "Squat Coach"
      : exercise === "pushup"
      ? "Push-up Coach"
      : "Plank Coach";

  return (
    <div style={styles.page}>
      {/* HEADER */}
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

      {/* MAIN */}
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

            <div style={{ ...styles.cameraWrap, position: "relative" }}>
              <CameraView ref={videoRef} />
              {countdown !== null && (
                <div style={styles.countdownOverlay}>
                  <div style={styles.countdownNumber}>{countdown}</div>
                  <div style={styles.countdownLabel}>Get ready</div>
                </div>
              )}
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

      {/* SUMMARY MODAL */}
      {engine.summary && (
        <WorkoutSummaryModal
          summary={engine.summary}
          onClose={handleSummaryClose}
        />
      )}

      {/* FOOTER */}
      <footer style={styles.footer}>
        © {new Date().getFullYear()} Kinetico · Built with MediaPipe Pose
      </footer>
    </div>
  );
}

/* STYLES */

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
  countdownOverlay: {
    position: "absolute",
    inset: 16,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    background: "rgba(0,0,0,0.6)",
    borderRadius: 16,
  },
  countdownNumber: {
    fontSize: 72,
    fontWeight: 900,
    color: "white",
  },
  countdownLabel: {
    fontSize: 18,
    fontWeight: 600,
    color: "rgba(255,255,255,0.7)",
    marginTop: 8,
  },
  footer: {
    padding: 16,
    textAlign: "center",
    borderTop: "1px solid rgba(148,163,184,0.12)",
  },
};