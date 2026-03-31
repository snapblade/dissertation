import { useRef } from "react";
import { calculateAngle } from "../pose/math";
import type { Exercise } from "../types/workout";

/* ───────────────────────────────────────
   DIFFICULTY THRESHOLDS
   Each difficulty tightens form checks.
   Values are tuned so "easy" only flags
   serious mistakes, while "hard" expects
   near-perfect form.

   LANDMARK REFERENCE (MediaPipe Pose):
   0  nose
   11 left shoulder    12 right shoulder
   13 left elbow       14 right elbow
   15 left wrist       16 right wrist
   23 left hip         24 right hip
   25 left knee        26 right knee
   27 left ankle       28 right ankle
   29 left heel        30 right heel
   31 left foot index  32 right foot index
─────────────────────────────────────── */

export type Difficulty = "easy" | "moderate" | "hard";

type SquatThresholds = {
  balanceDelta: number;       // max L/R knee angle difference (°)
  valgusRatio: number;        // min knee-width / ankle-width ratio
  forwardLeanAngle: number;   // min torso-to-vertical angle (°)
};

type PushupThresholds = {
  bodyLineAngle: number;      // min shoulder-hip-ankle angle (°)
  hipPikeAngle: number;       // max angle before flagging pike (°)
  elbowFlareAngle: number;    // max elbow-out angle (°)
  headDropThreshold: number;  // max nose below shoulder-mid (normalised)
};

type PlankThresholds = {
  bodyLineAngle: number;      // min shoulder-hip-ankle angle (°)
  hipPikeAngle: number;       // max angle before flagging pike (°)
  headDropThreshold: number;  // max nose below shoulder-mid (normalised)
  shoulderWristOffset: number; // max X offset shoulder-to-wrist (normalised)
};

type Thresholds = {
  squat: SquatThresholds;
  pushup: PushupThresholds;
  plank: PlankThresholds;
};

const THRESHOLDS: Record<Difficulty, Thresholds> = {
  easy: {
    squat: {
      balanceDelta: 20,
      valgusRatio: 0.6,
      forwardLeanAngle: 35,
    },
    pushup: {
      bodyLineAngle: 150,
      hipPikeAngle: 190,
      elbowFlareAngle: 80,
      headDropThreshold: 0.08,
    },
    plank: {
      bodyLineAngle: 155,
      hipPikeAngle: 190,
      headDropThreshold: 0.08,
      shoulderWristOffset: 0.12,
    },
  },
  moderate: {
    squat: {
      balanceDelta: 15,
      valgusRatio: 0.7,
      forwardLeanAngle: 30,
    },
    pushup: {
      bodyLineAngle: 160,
      hipPikeAngle: 185,
      elbowFlareAngle: 70,
      headDropThreshold: 0.06,
    },
    plank: {
      bodyLineAngle: 165,
      hipPikeAngle: 185,
      headDropThreshold: 0.06,
      shoulderWristOffset: 0.09,
    },
  },
  hard: {
    squat: {
      balanceDelta: 10,
      valgusRatio: 0.8,
      forwardLeanAngle: 25,
    },
    pushup: {
      bodyLineAngle: 170,
      hipPikeAngle: 180,
      elbowFlareAngle: 55,
      headDropThreshold: 0.04,
    },
    plank: {
      bodyLineAngle: 170,
      hipPikeAngle: 180,
      headDropThreshold: 0.04,
      shoulderWristOffset: 0.06,
    },
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
          switchCooldownRef.current = 60;
        }
      }
    }

    // ── angle calculation ──
    const angle = computePrimaryAngle(exercise, lm);

    // ── form checks ──
    const formIssues = checkForm(exercise, lm, difficulty);

    // ── score: 10 points per issue, floor at 0 ──
    const formScore = Math.max(0, 100 - formIssues.length * 10);

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
   PRIMARY ANGLE
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

  // plank → body line
  return bodyLineAngle(lm);
}

/* ───────────────────────────────────────
   BODY LINE (shoulder → hip → ankle)
─────────────────────────────────────── */

function bodyLineAngle(lm: any[]): number {
  const left = calculateAngle(lm[11], lm[23], lm[27]);
  const right = calculateAngle(lm[12], lm[24], lm[28]);
  return (left + right) / 2;
}

/* ───────────────────────────────────────
   TORSO ANGLE (lean relative to vertical)
   0° = perfectly upright, higher = more lean
─────────────────────────────────────── */

function torsoLeanAngle(lm: any[]): number {
  const shoulderMidX = (lm[11].x + lm[12].x) / 2;
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const hipMidX = (lm[23].x + lm[24].x) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;

  const dx = shoulderMidX - hipMidX;
  const dy = shoulderMidY - hipMidY;

  // angle from vertical (dy is dominant when upright)
  const radians = Math.atan2(Math.abs(dx), Math.abs(dy));
  return (radians * 180) / Math.PI;
}

/* ───────────────────────────────────────
   POSE DETECTION
─────────────────────────────────────── */

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

/* ═══════════════════════════════════════
   FORM CHECKS
   Each exercise has multiple checks.
   Only checks relevant to the current
   position fire (e.g. squat checks only
   run when knees are bent past 150°).
═══════════════════════════════════════ */

function checkForm(
  ex: Exercise,
  lm: any[],
  difficulty: Difficulty
): string[] {
  const t = THRESHOLDS[difficulty];
  const issues: string[] = [];

  if (ex === "squat") checkSquatForm(lm, t.squat, issues);
  if (ex === "pushup") checkPushupForm(lm, t.pushup, issues);
  if (ex === "plank") checkPlankForm(lm, t.plank, issues);

  return issues;
}

/* ─────────────────────────────────────
   SQUAT FORM CHECKS
   ─────────────────────────────────────
   1. Balance       — L/R knee angle symmetry
   2. Knee valgus   — knees caving inward
   3. Forward lean  — torso tilting too far
───────────────────────────────────── */

function checkSquatForm(
  lm: any[],
  t: SquatThresholds,
  issues: string[]
) {
  // skip if not standing upright (prevents false positives in pushup/plank position)
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;
  const torsoVertical = Math.abs(shoulderMidY - hipMidY) > 0.15;
  if (!torsoVertical) return;

  const leftKnee = calculateAngle(lm[23], lm[25], lm[27]);
  const rightKnee = calculateAngle(lm[24], lm[26], lm[28]);
  const avgKnee = (leftKnee + rightKnee) / 2;

  // only check form when user is actually squatting (below 150°)
  if (avgKnee > 150) return;

  // 1. Balance — asymmetric knee bend
  if (Math.abs(leftKnee - rightKnee) > t.balanceDelta) {
    issues.push("Balance your weight");
  }

  // 2. Knee valgus — knees caving inward
  const kneeWidth = Math.abs(lm[25].x - lm[26].x);
  const ankleWidth = Math.abs(lm[27].x - lm[28].x);

  if (ankleWidth > 0.01) {
    const ratio = kneeWidth / ankleWidth;
    if (ratio < t.valgusRatio) {
      issues.push("Push knees outward");
    }
  }

  // 3. Forward lean — torso tilting too far forward
  const lean = torsoLeanAngle(lm);
  if (lean > t.forwardLeanAngle) {
    issues.push("Keep chest up");
  }
}

/* ─────────────────────────────────────
   PUSHUP FORM CHECKS
   ─────────────────────────────────────
   1. Hip sag       — hips dropping below line
   2. Hip pike      — hips rising too high
   3. Elbow flare   — elbows splaying outward
   4. Head drop     — head hanging below shoulders
───────────────────────────────────── */

function checkPushupForm(
  lm: any[],
  t: PushupThresholds,
  issues: string[]
) {
  // skip all checks when standing upright
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;
  const torsoVertical = Math.abs(shoulderMidY - hipMidY) > 0.15;
  if (torsoVertical) return;

  const body = bodyLineAngle(lm);

  // 1. Hip sag — body line too low
  if (body < t.bodyLineAngle) {
    issues.push("Raise your hips");
  }

  // 2. Hip pike — hips too high (body bent upward)
  const ankleMidY = (lm[27].y + lm[28].y) / 2;
  const expectedHipY = (shoulderMidY + ankleMidY) / 2;

  if (hipMidY < expectedHipY - 0.05 && body > t.hipPikeAngle) {
    issues.push("Lower your hips");
  }

  // 3. Elbow flare — elbows pointing outward
  //    Measure the angle: shoulder → elbow → hip.
  //    When elbows tuck in, this angle is tight (~30-50°).
  //    When they flare out, it opens up (>70°).
  const leftFlare = calculateAngle(lm[11], lm[13], lm[23]);
  const rightFlare = calculateAngle(lm[12], lm[14], lm[24]);
  const avgFlare = (leftFlare + rightFlare) / 2;

  // only check during descent (elbow bent)
  const elbowAngle =
    (calculateAngle(lm[11], lm[13], lm[15]) +
      calculateAngle(lm[12], lm[14], lm[16])) / 2;

  if (elbowAngle < 140 && avgFlare > t.elbowFlareAngle) {
    issues.push("Tuck elbows in");
  }

  // 4. Head drop — nose significantly below shoulder line
  const noseY = lm[0].y;
  if (noseY - shoulderMidY > t.headDropThreshold) {
    issues.push("Keep head neutral");
  }
}

/* ─────────────────────────────────────
   PLANK FORM CHECKS
   ─────────────────────────────────────
   1. Hip sag       — hips dropping
   2. Hip pike      — hips too high
   3. Head drop     — head hanging
   4. Shoulder stack — shoulders over wrists
───────────────────────────────────── */

function checkPlankForm(
  lm: any[],
  t: PlankThresholds,
  issues: string[]
) {
  // skip all checks when standing upright
  const shoulderMidY = (lm[11].y + lm[12].y) / 2;
  const hipMidY = (lm[23].y + lm[24].y) / 2;
  const torsoVertical = Math.abs(shoulderMidY - hipMidY) > 0.15;
  if (torsoVertical) return;

  const body = bodyLineAngle(lm);

  // 1. Hip sag — core not engaged
  if (body < t.bodyLineAngle) {
    issues.push("Engage core");
  }

  // 2. Hip pike — hips too high
  const ankleMidY = (lm[27].y + lm[28].y) / 2;
  const expectedHipY = (shoulderMidY + ankleMidY) / 2;

  if (hipMidY < expectedHipY - 0.05 && body > t.hipPikeAngle) {
    issues.push("Lower your hips");
  }

  // 3. Head drop — nose well below shoulder line
  const noseY = lm[0].y;
  if (noseY - shoulderMidY > t.headDropThreshold) {
    issues.push("Keep head neutral");
  }

  // 4. Shoulder stack — shoulders should be directly over wrists
  //    Compare average shoulder X to average wrist X.
  const shoulderMidX = (lm[11].x + lm[12].x) / 2;
  const wristMidX = (lm[15].x + lm[16].x) / 2;

  if (Math.abs(shoulderMidX - wristMidX) > t.shoulderWristOffset) {
    issues.push("Align shoulders over wrists");
  }
}