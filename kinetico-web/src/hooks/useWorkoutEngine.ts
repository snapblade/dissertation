import { useEffect, useRef, useState, useCallback } from "react";
import type { Exercise, Workout } from "../types/workout";
import type { Difficulty } from "./useExerciseAnalyzer";

/*
 * AI ASSISTANCE DISCLOSURE 
 *
 * The adaptive difficulty system (adaptDifficulty function and form score
 * sampling logic in processFrame) was developed with AI assistance.
 *
 * Prompts used:
 * - "I noticed that after the first set it always goes from moderate to hard
 *    and no matter how bad I try to do the exercise it does not go back to
 *    easy the next set"
 * - "The form score only samples during active movement"
 *
 * Adaptations: The original implementation sampled form scores on every frame,
 * which inflated averages with idle-period scores of 100. This was diagnosed
 * through console logging and fixed by restricting sampling to the down phase
 * for squats/push-ups and throughout the active state for planks. The promote
 * threshold was changed from 85% to 80% and the deduction per issue from 10
 * to 50 based on testing. The PROFILES values (reps, rest, plank hold, depth)
 * were informed by expert consultation.
 */


/* 
   DIFFICULTY PROFILES
 */

type Profile = {
  repsPerSet: number;
  totalSets: number;
  restSeconds: number;
  plankSeconds: number;
  repDepth: number;
};

const PROFILES: Record<Difficulty, Profile> = {
  easy:     { repsPerSet: 4,  totalSets: 3, restSeconds: 8, plankSeconds: 8,  repDepth: 130 },
  moderate: { repsPerSet: 6,  totalSets: 3, restSeconds: 5, plankSeconds: 12, repDepth: 120 },
  hard:     { repsPerSet: 8,  totalSets: 3, restSeconds: 3, plankSeconds: 16, repDepth: 110 },
};

/* 
   ADAPTIVE THRESHOLDS
 */

const PROMOTE_SCORE = 80;
const DEMOTE_SCORE = 60;

/* 
   STATE TYPES
 */

export type WorkoutState =
  | "idle"
  | "active"
  | "resting"
  | "completed";

export type WorkoutSummary = {
  exercise: Exercise;
  difficulty: Difficulty;
  totalSets: number;
  repsPerSet: number;
  totalReps: number;
  duration: number;
  avgFormScore: number;
};

const CONFIRM_FRAMES = 3;

/* 
   HOOK
 */

export function useWorkoutEngine(exercise: Exercise) {
  /* render state (drives UI) */
  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);
  const [restTime, setRestTime] = useState(0);
  const [plankTime, setPlankTime] = useState(0);
  const [feedback, setFeedback] = useState("Ready");
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");
  const [state, setState] = useState<WorkoutState>("idle");
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);

  /* refs mirror state for use inside processFrame */
  const repsRef = useRef(0);
  const setsRef = useRef(1);
  const stateRef = useRef<WorkoutState>("idle");
  const difficultyRef = useRef<Difficulty>("moderate");
  const exerciseRef = useRef<Exercise>(exercise);

  const stageRef = useRef<"up" | "down">("up");
  const confirmRef = useRef(0);
  const minAngleRef = useRef(180);
  const plankStartRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const restIntervalRef = useRef<number | null>(null);

  const formScoresRef = useRef<number[]>([]);
  const allFormScoresRef = useRef<number[]>([]);

  /* keep exercise ref in sync */
  useEffect(() => {
    exerciseRef.current = exercise;
  }, [exercise]);

  /* reset when exercise changes */
  useEffect(() => {
    resetWorkout();
  }, [exercise]);

  /* helpers: update ref + state together */

  function setRepsSync(val: number) {
    repsRef.current = val;
    setReps(val);
  }

  function setSetsSync(val: number) {
    setsRef.current = val;
    setSets(val);
  }

  function setStateSync(val: WorkoutState) {
    stateRef.current = val;
    setState(val);
  }

  function setDifficultySync(val: Difficulty) {
    difficultyRef.current = val;
    setDifficulty(val);
  }

  function getProfile(): Profile {
    return PROFILES[difficultyRef.current];
  }

  /* start workout */

  function startWorkout() {
    if (stateRef.current !== "idle") return;
    setStateSync("active");
    startTimeRef.current = Date.now();
  }

  /* process each frame (called from App) */

  const processFrame = useCallback((
  angle: number,
  formScore: number,
  formIssues: string[]
) => {
  if (stateRef.current !== "active") return;
 
  // For squats/push-ups: only sample during the down phase.
  // For planks: sample throughout the active set so that bad form
  // (sag/pike) is captured even when the timer pauses.
  const isActiveMovement =
    exerciseRef.current === "plank"
      ? true
      : stageRef.current === "down";
 
  if (isActiveMovement) {
    formScoresRef.current.push(formScore);
    allFormScoresRef.current.push(formScore);
  }
 
  if (formIssues.length > 0) {
    setFeedback(formIssues[0]);
  } else {
    setFeedback("Good form");
  }
 
  if (exerciseRef.current === "plank") {
    processPlank(angle);
  } else {
    processRep(angle);
  }
}, []);

  /* rep counting (squat / pushup) */

  function processRep(angle: number) {
    // always track the lowest point reached
    if (angle < minAngleRef.current) {
      minAngleRef.current = angle;
    }

    // detect position
    const isUp = angle > 160;
    const isDescending = angle < 150;

    // user started going down → mark as "down"
    if (isDescending && stageRef.current === "up") {
      stageRef.current = "down";
      confirmRef.current = 0;
      return;
    }

    // user came back up → evaluate the attempt
    if (isUp && stageRef.current === "down") {
      confirmRef.current++;

      if (confirmRef.current >= CONFIRM_FRAMES) {
        const depthTarget = getProfile().repDepth;

        if (minAngleRef.current <= depthTarget) {
          // deep enough → count the rep
          const newReps = repsRef.current + 1;
          setRepsSync(newReps);

          if (newReps >= getProfile().repsPerSet) {
            completeSet();
          }
        } else {
          // attempted but didn't go deep enough
          setFeedback("Go lower");
        }

        stageRef.current = "up";
        confirmRef.current = 0;
        minAngleRef.current = 180;
      }
    }
  }

  /* plank hold */

  function processPlank(angle: number) {
    if (angle > 160) {
      if (!plankStartRef.current) {
        plankStartRef.current = performance.now();
      }
      const hold = (performance.now() - plankStartRef.current) / 1000;
      setPlankTime(hold);

      if (hold >= getProfile().plankSeconds) {
        plankStartRef.current = null;
        setPlankTime(0);
        completeSet();
      }
    } else {
      plankStartRef.current = null;
      setPlankTime(0);
    }
  }

  /* set completion → adapt → rest */

  function completeSet() {
    adaptDifficulty();
    formScoresRef.current = [];

    if (setsRef.current >= getProfile().totalSets) {
      finishWorkout();
      return;
    }

    setStateSync("resting");
    setRepsSync(0);

    let remaining = getProfile().restSeconds;
    setRestTime(remaining);

    restIntervalRef.current = window.setInterval(() => {
      remaining--;
      setRestTime(remaining);

      if (remaining <= 0) {
        clearInterval(restIntervalRef.current!);
        restIntervalRef.current = null;
        setSetsSync(setsRef.current + 1);
        setStateSync("active");
        stageRef.current = "up";
        confirmRef.current = 0;
      }
    }, 1000);
  }

  /* adaptive difficulty */

  function adaptDifficulty() {
    if (formScoresRef.current.length === 0) return;

    const avg =
      formScoresRef.current.reduce((a, b) => a + b, 0) /
      formScoresRef.current.length;

    const current = difficultyRef.current;

    if (avg >= PROMOTE_SCORE && current !== "hard") {
      setDifficultySync(current === "easy" ? "moderate" : "hard");
    } else if (avg < DEMOTE_SCORE && current !== "easy") {
      setDifficultySync(current === "hard" ? "moderate" : "easy");
    }
  }

  /* workout complete */

  function finishWorkout() {
    setStateSync("completed");

    const duration = startTimeRef.current
      ? Math.floor((Date.now() - startTimeRef.current) / 1000)
      : 0;

    const avgForm =
      allFormScoresRef.current.length > 0
        ? Math.round(
            allFormScoresRef.current.reduce((a, b) => a + b, 0) /
              allFormScoresRef.current.length
          )
        : 0;

    const profile = getProfile();

    const workout: Workout = {
      id: crypto.randomUUID(),
      exercise: exerciseRef.current,
      totalSets: profile.totalSets,
      repsPerSet: profile.repsPerSet,
      date: new Date().toISOString(),
      duration,
    };

    const existing = JSON.parse(localStorage.getItem("workouts") || "[]");
    localStorage.setItem("workouts", JSON.stringify([workout, ...existing]));

    setSummary({
      exercise: exerciseRef.current,
      difficulty: difficultyRef.current,
      totalSets: profile.totalSets,
      repsPerSet: profile.repsPerSet,
      totalReps: profile.totalSets * profile.repsPerSet,
      duration,
      avgFormScore: avgForm,
    });
  }

  /* reset */

  function resetWorkout() {
    if (restIntervalRef.current) {
      clearInterval(restIntervalRef.current);
      restIntervalRef.current = null;
    }

    setStateSync("idle");
    setRepsSync(0);
    setSetsSync(1);
    setRestTime(0);
    setPlankTime(0);
    setSummary(null);
    setFeedback("Ready");
    setDifficultySync("moderate");

    stageRef.current = "up";
    confirmRef.current = 0;
    minAngleRef.current = 180;
    plankStartRef.current = null;
    startTimeRef.current = null;
    formScoresRef.current = [];
    allFormScoresRef.current = [];
  }

  /* cleanup */

  useEffect(() => {
    return () => {
      if (restIntervalRef.current) clearInterval(restIntervalRef.current);
    };
  }, []);

  return {
    state,
    difficulty,
    reps,
    sets,
    restTime,
    plankTime,
    feedback,
    summary,
    profile: PROFILES[difficulty],
    startWorkout,
    processFrame,
    resetWorkout,
    setDifficulty: setDifficultySync,
  };
}