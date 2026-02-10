import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker
} from "@mediapipe/tasks-vision";

import { calculateAngle } from "../pose/math";

type Exercise = "squat" | "pushup" | "plank";

const VIS_THRESH = 0.6;
const CONFIRM_FRAMES = 3;

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [exercise, setExercise] = useState<Exercise>("squat");
  const [reps, setReps] = useState(0);
  const [stage, setStage] = useState<"up" | "down">("up");
  const [angle, setAngle] = useState(0);
  const [confirm, setConfirm] = useState(0);
  const [plankTime, setPlankTime] = useState(0);

  useEffect(() => {
    let landmarker: PoseLandmarker;
    let plankStart = 0;

    // =========================
    // Keyboard switching
    // =========================
    function reset(ex: Exercise) {
      setExercise(ex);
      setReps(0);
      setStage("up");
      setAngle(0);
      setConfirm(0);
      setPlankTime(0);
      plankStart = 0;
    }

    function handleKey(e: KeyboardEvent) {
      if (e.key === "1") reset("squat");
      if (e.key === "2") reset("pushup");
      if (e.key === "3") reset("plank");
    }

    window.addEventListener("keydown", handleKey);

    // =========================
    // Setup MediaPipe
    // =========================
    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
        },
        runningMode: "VIDEO",
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      requestAnimationFrame(loop);
    }

    // =========================
    // Drawing helpers
    // =========================
    function drawPoint(ctx: CanvasRenderingContext2D, x: number, y: number) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    function avgVisibility(points: any[]) {
      return points.reduce((s, p) => s + p.visibility, 0) / points.length;
    }

    function confirmStage(target: "up" | "down") {
      if (target !== stage) {
        setConfirm((c) => {
          if (c + 1 >= CONFIRM_FRAMES) {
            if (stage === "down" && target === "up") {
              setReps((r) => r + 1);
            }
            setStage(target);
            return 0;
          }
          return c + 1;
        });
      } else {
        setConfirm(0);
      }
    }

    // =========================
    // Main loop
    // =========================
    async function loop() {
      if (!videoRef.current || !canvasRef.current) return;

      const results = landmarker.detectForVideo(
        videoRef.current,
        performance.now()
      );

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      const width = 640;
      const height = 480;

      ctx.clearRect(0, 0, width, height);

      if (results.landmarks.length > 0) {
        const lm = results.landmarks[0];

        ctx.fillStyle = "lime";
        lm.forEach((p) => drawPoint(ctx, p.x * width, p.y * height));

        // =========================
        // SQUAT
        // =========================
        if (exercise === "squat") {
          const pts = [lm[23], lm[25], lm[27], lm[24], lm[26], lm[28]];

          if (avgVisibility(pts) > VIS_THRESH) {
            const left = calculateAngle(lm[23], lm[25], lm[27]);
            const right = calculateAngle(lm[24], lm[26], lm[28]);
            const kneeAngle = (left + right) / 2;

            setAngle(kneeAngle);

            if (kneeAngle < 105) confirmStage("down");
            if (kneeAngle > 165) confirmStage("up");
          }
        }

        // =========================
        // PUSHUP
        // =========================
        if (exercise === "pushup") {
          const pts = [lm[11], lm[13], lm[15], lm[12], lm[14], lm[16]];

          if (avgVisibility(pts) > VIS_THRESH) {
            const left = calculateAngle(lm[11], lm[13], lm[15]);
            const right = calculateAngle(lm[12], lm[14], lm[16]);
            const elbowAngle = (left + right) / 2;

            setAngle(elbowAngle);

            if (elbowAngle < 95) confirmStage("down");
            if (elbowAngle > 160) confirmStage("up");
          }
        }

        // =========================
        // PLANK
        // =========================
        if (exercise === "plank") {
          const pts = [lm[11], lm[23], lm[27], lm[12], lm[24], lm[28]];

          if (avgVisibility(pts) > VIS_THRESH) {
            const left = calculateAngle(lm[11], lm[23], lm[27]);
            const right = calculateAngle(lm[12], lm[24], lm[28]);
            const bodyAngle = (left + right) / 2;

            setAngle(bodyAngle);

            if (bodyAngle > 165) {
              if (!plankStart) plankStart = performance.now();
              setPlankTime((performance.now() - plankStart) / 1000);
            } else {
              plankStart = 0;
              setPlankTime(0);
            }
          }
        }
      }

      requestAnimationFrame(loop);
    }

    setup();

    return () => window.removeEventListener("keydown", handleKey);
  }, [exercise, stage]);

  // =========================
  // UI
  // =========================
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 640, height: 480, margin: "0 auto" }}>
        <video
          ref={videoRef}
          width={640}
          height={480}
          autoPlay
          playsInline
          style={{ position: "absolute", top: 0, left: 0 }}
        />

        <canvas
          ref={canvasRef}
          width={640}
          height={480}
          style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
        />
      </div>

      <h2>Exercise: {exercise.toUpperCase()} (1/2/3)</h2>

      {exercise === "plank" ? (
        <h2>Hold: {plankTime.toFixed(1)}s</h2>
      ) : (
        <>
          <h2>Reps: {reps}</h2>
          <p>Stage: {stage}</p>
        </>
      )}

      <p>Angle: {angle.toFixed(0)}°</p>
    </div>
  );
}
