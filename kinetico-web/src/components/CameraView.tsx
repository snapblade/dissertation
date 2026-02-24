import { useEffect, useRef } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateAngle } from "../pose/math";

export type Exercise = "squat" | "pushup" | "plank";

export type CoachStats = {
  exercise: Exercise;
  reps: number;
  angle: number;
  plankTime: number;
  feedback: string;
  inView: boolean;
};

const VIS_THRESH = 0.6;
const CONFIRM_FRAMES = 3;

const SQUAT_DOWN = 105;
const SQUAT_UP = 165;

const PUSHUP_DOWN = 95;
const PUSHUP_UP = 160;

type Props = {
  exercise: Exercise;
  running: boolean;
  voiceEnabled: boolean;
  onStats: (stats: CoachStats) => void;
};

export default function CameraView({ exercise, running, voiceEnabled, onStats }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // refs for realtime tracking
  const exerciseRef = useRef<Exercise>(exercise);
  const runningRef = useRef<boolean>(running);
  const voiceRef = useRef<boolean>(voiceEnabled);

  const repsRef = useRef({ squat: 0, pushup: 0 });
  const stageRef = useRef({ squat: "up", pushup: "up" });
  const confirmRef = useRef({ squat: 0, pushup: 0 });

  const plankStartRef = useRef<number | null>(null);

  const lastSpokenRef = useRef("");
  const lastSpeakTimeRef = useRef(0);

  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { voiceRef.current = voiceEnabled; }, [voiceEnabled]);

  function speak(text: string) {
    if (!voiceRef.current) return;

    const now = Date.now();
    if (text !== lastSpokenRef.current && now - lastSpeakTimeRef.current > 1400) {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      lastSpokenRef.current = text;
      lastSpeakTimeRef.current = now;
    }
  }

  function emit(stats: Partial<CoachStats>) {
    onStats({
      exercise: exerciseRef.current,
      reps: exerciseRef.current === "pushup" ? repsRef.current.pushup : repsRef.current.squat,
      angle: 0,
      plankTime: 0,
      feedback: "Ready",
      inView: true,
      ...stats
    });
  }

  useEffect(() => {
    let landmarker: PoseLandmarker;
    let active = true;

    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
        },
        runningMode: "VIDEO"
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      requestAnimationFrame(loop);
    }

    const drawPoint = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    function visibility(lm: any[], ...ids: number[]) {
      return ids.reduce((s, i) => s + lm[i].visibility, 0) / ids.length;
    }

    function loop() {
      if (!active || !videoRef.current || !canvasRef.current) return;

      const ctx = canvasRef.current.getContext("2d")!;
      const w = 640;
      const h = 480;
      ctx.clearRect(0, 0, w, h);

      if (!runningRef.current) {
        emit({ feedback: "Paused", angle: 0, inView: true, plankTime: 0 });
        requestAnimationFrame(loop);
        return;
      }

      const res = landmarker.detectForVideo(videoRef.current, performance.now());

      if (res.landmarks.length === 0) {
        emit({ inView: false, feedback: "No person detected", angle: 0, plankTime: 0 });
        requestAnimationFrame(loop);
        return;
      }

      const lm = res.landmarks[0];
      ctx.fillStyle = "lime";
      lm.forEach((p) => drawPoint(ctx, p.x * w, p.y * h));

      const ex = exerciseRef.current;

      // ---------------- SQUAT ----------------
      if (ex === "squat") {
        const v = visibility(lm, 23, 25, 27, 24, 26, 28);
        if (v < VIS_THRESH) {
          emit({ inView: false, feedback: "Move fully into frame", angle: 0, plankTime: 0 });
          speak("Move into frame");
        } else {
          const left = calculateAngle(lm[23], lm[25], lm[27]);
          const right = calculateAngle(lm[24], lm[26], lm[28]);
          const knee = (left + right) / 2;

          let fb = "Nice squat";
          if (knee > 140) fb = "Go deeper";
          else if (knee > 100) fb = "Almost there";
          else if (knee < 95) fb = "Good depth";

          speak(fb);

          let target: "up" | "down" | null = null;
          if (knee < SQUAT_DOWN) target = "down";
          if (knee > SQUAT_UP) target = "up";

          if (target && target !== stageRef.current.squat) {
            confirmRef.current.squat++;
            if (confirmRef.current.squat >= CONFIRM_FRAMES) {
              if (stageRef.current.squat === "down" && target === "up") {
                repsRef.current.squat++;
              }
              stageRef.current.squat = target;
              confirmRef.current.squat = 0;
            }
          } else confirmRef.current.squat = 0;

          emit({
            inView: true,
            feedback: fb,
            angle: knee,
            reps: repsRef.current.squat,
            plankTime: 0
          });
        }
      }

      // ---------------- PUSHUP ----------------
      if (ex === "pushup") {
        const v = visibility(lm, 11, 13, 15, 12, 14, 16);
        if (v < VIS_THRESH) {
          emit({ inView: false, feedback: "Move into view", angle: 0, plankTime: 0 });
          speak("Move into view");
        } else {
          const left = calculateAngle(lm[11], lm[13], lm[15]);
          const right = calculateAngle(lm[12], lm[14], lm[16]);
          const elbow = (left + right) / 2;

          let fb = "Good push-up";
          if (elbow > 120) fb = "Go lower";
          else if (elbow > 90) fb = "Almost there";
          else if (elbow < 85) fb = "Nice depth";

          speak(fb);

          let target: "up" | "down" | null = null;
          if (elbow < PUSHUP_DOWN) target = "down";
          if (elbow > PUSHUP_UP) target = "up";

          if (target && target !== stageRef.current.pushup) {
            confirmRef.current.pushup++;
            if (confirmRef.current.pushup >= CONFIRM_FRAMES) {
              if (stageRef.current.pushup === "down" && target === "up") {
                repsRef.current.pushup++;
              }
              stageRef.current.pushup = target;
              confirmRef.current.pushup = 0;
            }
          } else confirmRef.current.pushup = 0;

          emit({
            inView: true,
            feedback: fb,
            angle: elbow,
            reps: repsRef.current.pushup,
            plankTime: 0
          });
        }
      }

      // ---------------- PLANK ----------------
      if (ex === "plank") {
        const v = visibility(lm, 11, 23, 27, 12, 24, 28);
        if (v < VIS_THRESH) {
          plankStartRef.current = null;
          emit({ inView: false, feedback: "Move into view", angle: 0, plankTime: 0 });
          speak("Move into view");
        } else {
          const left = calculateAngle(lm[11], lm[23], lm[27]);
          const right = calculateAngle(lm[12], lm[24], lm[28]);
          const body = (left + right) / 2;

          let fb = "Fix your form";
          let hold = 0;

          if (body > 165) {
            fb = "Solid plank";
            if (!plankStartRef.current) plankStartRef.current = performance.now();
            hold = (performance.now() - plankStartRef.current) / 1000;
          } else if (body > 150) {
            fb = "Adjust hips slightly";
            plankStartRef.current = null;
            hold = 0;
          } else {
            fb = "Fix your form";
            plankStartRef.current = null;
            hold = 0;
          }

          speak(fb);

          emit({
            inView: true,
            feedback: fb,
            angle: body,
            reps: 0,
            plankTime: hold
          });
        }
      }

      requestAnimationFrame(loop);
    }

    setup();

    return () => {
      active = false;
    };
  }, [onStats]);

  return (
   <div style={{
  position: "relative",
  width: "100%",
  aspectRatio: "4 / 3",
  maxHeight: "70vh"
}}>
     <video
  ref={videoRef}
  autoPlay
  playsInline
  style={{
    width: "100%",
    height: "100%",
    objectFit: "cover",
    borderRadius: 16
  }}
/>
      <canvas
  ref={canvasRef}
  style={{
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    borderRadius: 16
  }}
/>
    </div>
  );
}
