import { useEffect, useRef } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { calculateAngle } from "../pose/math";

export type Exercise = "squat" | "pushup" | "plank";

export type CoachStats = {
  exercise: Exercise;
  reps: number;
  sets: number;
  angle: number;
  plankTime: number;
  feedback: string;
  inView: boolean;
  resting: boolean;
  restTime: number;
  formScore: number;
  formIssues: string[];
  primaryIssue: string | null;
  difficulty: "easy" | "moderate" | "hard" | "advanced";
};

const CONFIRM_FRAMES = 3;
const DETECT_THRESHOLD = 30;
const ISSUE_THRESHOLD = 20;

type Props = {
  exercise: Exercise;
  running: boolean;
  voiceEnabled: boolean;
  onStats: (stats: CoachStats) => void;
};

export default function CameraView({
  exercise,
  running,
  voiceEnabled,
  onStats
}: Props) {

  const videoRef = useRef<HTMLVideoElement>(null);

  const exerciseRef = useRef<Exercise>(exercise);
  const voiceRef = useRef<boolean>(voiceEnabled);

  const repsRef = useRef({ squat: 0, pushup: 0 });
  const setsRef = useRef({ squat: 1, pushup: 1 });
  const stageRef = useRef({ squat: "up", pushup: "up" });
  const confirmRef = useRef({ squat: 0, pushup: 0 });

  const plankStartRef = useRef<number | null>(null);

  const repScoresRef = useRef<number[]>([]);
  const formScoreRef = useRef<number>(100);

  const issuesRef = useRef<string[]>([]);
  const primaryIssueRef = useRef<string | null>(null);
  const issueConfidenceRef = useRef<number>(0);
  const lastSpokenIssueRef = useRef<string | null>(null);

  const detectedRef = useRef<Exercise | null>(null);
  const confidenceRef = useRef<number>(0);

  useEffect(() => { exerciseRef.current = exercise; }, [exercise]);
  useEffect(() => { voiceRef.current = voiceEnabled; }, [voiceEnabled]);

  function speak(text: string) {
    if (!voiceRef.current) return;
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }

  function resetWorkoutState() {
    repsRef.current = { squat: 0, pushup: 0 };
    setsRef.current = { squat: 1, pushup: 1 };
    stageRef.current = { squat: "up", pushup: "up" };
    confirmRef.current = { squat: 0, pushup: 0 };
    repScoresRef.current = [];
    formScoreRef.current = 100;
    issuesRef.current = [];
    primaryIssueRef.current = null;
    issueConfidenceRef.current = 0;
    lastSpokenIssueRef.current = null;
    plankStartRef.current = null;
  }

  function computeDifficulty(
    formScore: number,
    issueCount: number
  ): "easy" | "moderate" | "hard" | "advanced" {

    if (formScore > 90 && issueCount === 0)
      return "easy";

    if (formScore > 75 && issueCount <= 1)
      return "moderate";

    if (formScore > 60)
      return "hard";

    return "advanced";
  }

  function detectExercise(lm: any[]): Exercise | null {

    const shoulderMidY = (lm[11].y + lm[12].y) / 2;
    const hipMidY = (lm[23].y + lm[24].y) / 2;
    const torsoVertical = Math.abs(shoulderMidY - hipMidY) > 0.15;

    const knee =
      (calculateAngle(lm[23], lm[25], lm[27]) +
       calculateAngle(lm[24], lm[26], lm[28])) / 2;

    const elbow =
      (calculateAngle(lm[11], lm[13], lm[15]) +
       calculateAngle(lm[12], lm[14], lm[16])) / 2;

    const body =
      (calculateAngle(lm[11], lm[23], lm[27]) +
       calculateAngle(lm[12], lm[24], lm[28])) / 2;

    if (torsoVertical && knee < 150)
      return "squat";

    if (!torsoVertical && elbow < 150)
      return "pushup";

    if (!torsoVertical && elbow > 160 && body > 160)
      return "plank";

    return null;
  }

  function detectFormIssues(
    ex: Exercise,
    lm: any[],
    left: number,
    right: number,
    angle: number
  ): string[] {

    const issues: string[] = [];

    if (ex === "squat") {
      if (Math.abs(left - right) > 15)
        issues.push("Balance your weight");

      if (angle > 140)
        issues.push("Go lower");

      const torso =
        calculateAngle(lm[11], lm[23], { x: lm[23].x, y: lm[23].y - 0.2 });

      if (torso < 70)
        issues.push("Keep chest up");
    }

    if (ex === "pushup") {
      const body =
        (calculateAngle(lm[11], lm[23], lm[27]) +
         calculateAngle(lm[12], lm[24], lm[28])) / 2;

      if (body < 155)
        issues.push("Lower hips");

      if (body > 178)
        issues.push("Don't raise hips");

      if (Math.abs(left - right) > 20)
        issues.push("Keep arms even");
    }

    if (ex === "plank") {
      const body =
        (calculateAngle(lm[11], lm[23], lm[27]) +
         calculateAngle(lm[12], lm[24], lm[28])) / 2;

      if (body < 160)
        issues.push("Engage core");

      if (body > 178)
        issues.push("Lower hips slightly");
    }

    return issues;
  }

  function emit(stats: Partial<CoachStats>) {

    const difficulty = computeDifficulty(
      formScoreRef.current,
      issuesRef.current.length
    );

    onStats({
      exercise: exerciseRef.current,
      reps: repsRef.current[exerciseRef.current === "pushup" ? "pushup" : "squat"],
      sets: setsRef.current[exerciseRef.current === "pushup" ? "pushup" : "squat"],
      angle: 0,
      plankTime: 0,
      feedback: primaryIssueRef.current ?? "Good form",
      inView: true,
      resting: false,
      restTime: 0,
      formScore: formScoreRef.current,
      formIssues: issuesRef.current,
      primaryIssue: primaryIssueRef.current,
      difficulty,
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

    function loop() {

      if (!active || !videoRef.current) return;

      const res = landmarker.detectForVideo(videoRef.current, performance.now());
      if (!res.landmarks.length) {
        emit({ inView: false });
        requestAnimationFrame(loop);
        return;
      }

      const lm = res.landmarks[0];

      const candidate = detectExercise(lm);

      if (candidate) {

        if (detectedRef.current === candidate)
          confidenceRef.current++;
        else {
          detectedRef.current = candidate;
          confidenceRef.current = 0;
        }

        if (confidenceRef.current > DETECT_THRESHOLD) {

          if (exerciseRef.current !== candidate) {
            speak(`Detected ${candidate}`);
            resetWorkoutState();
            exerciseRef.current = candidate;
          }

          confidenceRef.current = 0;
        }
      }

      const ex = exerciseRef.current;

      if (ex === "plank") {

        const body =
          (calculateAngle(lm[11], lm[23], lm[27]) +
           calculateAngle(lm[12], lm[24], lm[28])) / 2;

        if (body > 165) {
          if (!plankStartRef.current)
            plankStartRef.current = performance.now();
        } else {
          plankStartRef.current = null;
        }

        const hold = plankStartRef.current
          ? (performance.now() - plankStartRef.current) / 1000
          : 0;

        emit({ angle: body, plankTime: hold });

      } else {

        const ids = ex === "squat"
          ? [23,25,27,24,26,28]
          : [11,13,15,12,14,16];

        const left = calculateAngle(lm[ids[0]], lm[ids[1]], lm[ids[2]]);
        const right = calculateAngle(lm[ids[3]], lm[ids[4]], lm[ids[5]]);
        const angle = (left + right) / 2;

        const detectedIssues = detectFormIssues(ex, lm, left, right, angle);
        issuesRef.current = detectedIssues;

        if (detectedIssues.length > 0) {

          const top = detectedIssues[0];

          if (primaryIssueRef.current === top)
            issueConfidenceRef.current++;
          else {
            primaryIssueRef.current = top;
            issueConfidenceRef.current = 0;
          }

          if (
            issueConfidenceRef.current > ISSUE_THRESHOLD &&
            lastSpokenIssueRef.current !== top
          ) {
            speak(top);
            lastSpokenIssueRef.current = top;
          }

        } else {
          primaryIssueRef.current = null;
          issueConfidenceRef.current = 0;
        }

        let target: "up" | "down" | null = null;

        if (angle < 110) target = "down";
        if (angle > 160) target = "up";

        if (target && target !== stageRef.current[ex]) {

          confirmRef.current[ex]++;

          if (confirmRef.current[ex] >= CONFIRM_FRAMES) {

            if (stageRef.current[ex] === "down" && target === "up") {
              repsRef.current[ex]++;
              if (!primaryIssueRef.current)
                speak(String(repsRef.current[ex]));
            }

            stageRef.current[ex] = target;
            confirmRef.current[ex] = 0;
          }
        }

        emit({ angle });
      }

      requestAnimationFrame(loop);
    }

    setup();
    return () => { active = false; };

  }, [onStats]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      style={{ width: "100%", borderRadius: 16 }}
    />
  );
}