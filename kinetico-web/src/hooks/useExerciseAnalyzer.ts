import { useRef } from "react";
import { calculateAngle } from "../pose/math";
import type { Exercise } from "../types/workout";

/* ───────────────────────────────────────
   DIFFICULTY THRESHOLDS
   Each difficulty tightens form checks
─────────────────────────────────────── */

export type Difficulty = "easy" | "moderate" | "hard";

type Thresholds = {
  squat: { depthAngle: number; balanceDelta: number };
  pushup: { bodyLineAngle: number };
  plank: { bodyLineAngle: number };
};

const THRESHOLDS: Record<Difficulty, Thresholds> = {
  easy: {
    squat: { depthAngle: 130, balanceDelta: 20 },
    pushup: { bodyLineAngle: 150 },
    plank: { bodyLineAngle: 155 },
  },
  moderate: {
    squat: { depthAngle: 120, balanceDelta: 15 },
    pushup: { bodyLineAngle: 160 },
    plank: { bodyLineAngle: 165 },
  },
  hard: {
    squat: { depthAngle: 110, balanceDelta: 10 },
    pushup: { bodyLineAngle: 170 },
    plank: { bodyLineAngle: 170 },
  },
};

/* ───────────────────────────────────────
   AUTO-DETECT CONFIG
─────────────────────────────────────── */

const DETECT_FRAMES = 40;

/* ───────────────────────────────────────
   ANALYSIS RESULT
─────────────────────────────────────── */

export type AnalysisResult = {
  angle: number;
  formIssues: string[];
  formScore: number;
  detectedExercise: Exercise | null;
  inView: boolean;
};

/* ───────────────────────────────────────
   HOOK
─────────────────────────────────────── */

export function useExerciseAnalyzer(difficulty: Difficulty) {
  const detectBufferRef = useRef<Exercise | null>(null);
  const detectCountRef = useRef(0);
  const confirmedRef = useRef<Exercise | null>(null);
  const switchCooldownRef = useRef(0);

  function analyze(
    landmarks: any[] | null,
    exercise: Exercise
  ): AnalysisResult {
    if (!landmarks || landmarks.length < 33) {
      return {
        angle: 0,
        formIssues: [],
        formScore: 100,
        detectedExercise: confirmedRef.current,
        inView: false,
      };
    }

    const lm = landmarks;

    // ── auto-detect (paused during cooldown) ──
    if (switchCooldownRef.current > 0) {
      switchCooldownRef.current--;
    } else {
      const candidate = detectPose(lm);
      if (candidate) {
        // if same as current exercise, just reset — no need to "detect" it
        if (candidate === exercise) {
          detectBufferRef.current = null;
          detectCountRef.current = 0;
        } else if (detectBufferRef.current === candidate) {
          detectCountRef.current++;
        } else {
          detectBufferRef.current = candidate;
          detectCountRef.current = 1;
        }

        if (detectCountRef.current >= DETECT_FRAMES) {
          confirmedRef.current = candidate;
          detectCountRef.current = 0;
          // cooldown: ignore detection for ~2 seconds (60 frames)
          switchCooldownRef.current = 60;
        }
      }
    }

    // ── angle calculation ──
    const angle = computePrimaryAngle(exercise, lm);

    // ── form checks ──
    const formIssues = checkForm(exercise, lm, difficulty);

    // ── score (100 minus penalty per issue) ──
    const formScore = Math.max(0, 100 - formIssues.length * 15);

    return {
      angle,
      formIssues,
      formScore,
      detectedExercise: confirmedRef.current,
      inView: true,
    };
  }

  function reset() {
    detectBufferRef.current = null;
    detectCountRef.current = 0;
    confirmedRef.current = null;
    switchCooldownRef.current = 0;
  }

  function pauseDetection() {
    switchCooldownRef.current = 60;
  }

  return { analyze, reset, pauseDetection };
}

/* ───────────────────────────────────────
   HELPERS
─────────────────────────────────────── */

function computePrimaryAngle(ex: Exercise, lm: any[]): number {
  if (ex === "squat") {
    const left = calculateAngle(lm[23], lm[25], lm[27]);
    const right = calculateAngle(lm[24], lm[26], lm[28]);
    return (left + right) / 2;
  }

  if (ex === "pushup") {
    const left = calculateAngle(lm[11], lm[13], lm[15]);
    const right = calculateAngle(lm[12], lm[14], lm[16]);
    return (left + right) / 2;
  }

  // plank → body line angle
  const left = calculateAngle(lm[11], lm[23], lm[27]);
  const right = calculateAngle(lm[12], lm[24], lm[28]);
  return (left + right) / 2;
}

function bodyLineAngle(lm: any[]): number {
  const left = calculateAngle(lm[11], lm[23], lm[27]);
  const right = calculateAngle(lm[12], lm[24], lm[28]);
  return (left + right) / 2;
}

function detectPose(lm: any[]): Exercise | null {
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;
  const torsoVertical = Math.abs(shoulderMidY - hipMidY) > 0.15;

  const knee =
    (calculateAngle(lm[23], lm[25], lm[27]) +
      calculateAngle(lm[24], lm[26], lm[28])) /
    2;

  const elbow =
    (calculateAngle(lm[11], lm[13], lm[15]) +
      calculateAngle(lm[12], lm[14], lm[16])) /
    2;

  const body = bodyLineAngle(lm);

  if (torsoVertical && knee < 150) return "squat";
  if (!torsoVertical && elbow < 150) return "pushup";
  if (!torsoVertical && elbow > 160 && body > 160) return "plank";

  return null;
}

function checkForm(
  ex: Exercise,
  lm: any[],
  difficulty: Difficulty
): string[] {
  const t = THRESHOLDS[difficulty];
  const issues: string[] = [];

  if (ex === "squat") {
    const left = calculateAngle(lm[23], lm[25], lm[27]);
    const right = calculateAngle(lm[24], lm[26], lm[28]);

    if (Math.abs(left - right) > t.squat.balanceDelta)
      issues.push("Balance your weight");
  }

  if (ex === "pushup") {
    const body = bodyLineAngle(lm);
    if (body < t.pushup.bodyLineAngle) issues.push("Keep body straight");
  }

  if (ex === "plank") {
    const body = bodyLineAngle(lm);
    if (body < t.plank.bodyLineAngle) issues.push("Engage core");
  }

  return issues;
}