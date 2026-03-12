import { useEffect, useRef, useState } from "react";
import type { Exercise } from "../components/CameraView";
import type { Workout } from "../types/workout";

/* ===============================
   BASE CONFIG
================================ */

const BASE_REPS = 5;
const BASE_SETS = 3;
const BASE_REST = 5;
const BASE_PLANK = 10;

/* ===============================
   TYPES
================================ */

export type WorkoutState =
  | "idle"
  | "active_set"
  | "resting"
  | "completed";

export type Difficulty =
  | "easy"
  | "moderate"
  | "hard"
  | "advanced";

export type WorkoutSummary = {
  exercise: Exercise;
  totalSets: number;
  finalRepsPerSet: number;
  totalReps: number;
  duration: number;
  averageFormScore: number;
};

export function useWorkoutEngine(exercise: Exercise) {

  const [state, setState] = useState<WorkoutState>("idle");
  const [difficulty, setDifficulty] = useState<Difficulty>("moderate");

  const [reps, setReps] = useState(0);
  const [sets, setSets] = useState(1);

  const [targetReps, setTargetReps] = useState(BASE_REPS);
  const [restTime, setRestTime] = useState(BASE_REST);
  const [restDuration, setRestDuration] = useState(BASE_REST);

  const [plankTime, setPlankTime] = useState(0);
  const [plankDuration, setPlankDuration] = useState(BASE_PLANK);

  const [summary, setSummary] = useState<WorkoutSummary | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const restIntervalRef = useRef<number | null>(null);
  const plankIntervalRef = useRef<number | null>(null);

  const formScoresRef = useRef<number[]>([]);
  const allFormScoresRef = useRef<number[]>([]);

  useEffect(() => {
    resetWorkout();
  }, [exercise]);

  function startWorkout() {
    if (state !== "idle") return;
    setState("active_set");
    startTimeRef.current = Date.now();
  }

  function recordFormScore(score: number) {
    formScoresRef.current.push(score);
    allFormScoresRef.current.push(score);
  }

  function completeRep() {
    if (state !== "active_set") return;

    const newReps = reps + 1;
    setReps(newReps);

    if (newReps >= targetReps) {
      adaptAfterSet();
      moveToRest();
    }
  }

  function startPlankTimer() {
    if (state !== "active_set") return;
    if (plankIntervalRef.current) return;

    plankIntervalRef.current = window.setInterval(() => {
      setPlankTime((t) => {
        if (t + 1 >= plankDuration) {
          clearInterval(plankIntervalRef.current!);
          plankIntervalRef.current = null;
          adaptAfterSet();
          moveToRest();
          return 0;
        }
        return t + 1;
      });
    }, 1000);
  }

  /* ===============================
     ADAPTIVE LOGIC
  ================================ */

  function adaptAfterSet() {
    if (formScoresRef.current.length === 0) return;

    const avg =
      formScoresRef.current.reduce((a,b)=>a+b,0) /
      formScoresRef.current.length;

    // High performance
    if (avg >= 90) {
      setTargetReps(r => r + 1);
      setRestDuration(r => Math.max(3, r - 1));
      setPlankDuration(p => p + 2);
    }

    // Low performance
    if (avg < 75) {
      setTargetReps(r => Math.max(3, r - 1));
      setRestDuration(r => r + 2);
      setPlankDuration(p => Math.max(6, p - 2));
    }

    updateDifficulty();
    formScoresRef.current = [];
  }

  function updateDifficulty() {
    let score = 0;

    if (targetReps >= BASE_REPS + 2) score += 2;
    else if (targetReps >= BASE_REPS + 1) score += 1;

    if (restDuration <= BASE_REST - 2) score += 2;
    else if (restDuration <= BASE_REST - 1) score += 1;

    if (plankDuration >= BASE_PLANK + 4) score += 2;
    else if (plankDuration >= BASE_PLANK + 2) score += 1;

    if (score >= 5) setDifficulty("advanced");
    else if (score >= 3) setDifficulty("hard");
    else if (score >= 1) setDifficulty("moderate");
    else setDifficulty("easy");
  }

  function moveToRest() {
    setState("resting");
    setReps(0);
    setRestTime(restDuration);

    restIntervalRef.current = window.setInterval(() => {
      setRestTime(t => {
        if (t <= 1) {
          clearInterval(restIntervalRef.current!);
          restIntervalRef.current = null;
          nextSet();
          return restDuration;
        }
        return t - 1;
      });
    }, 1000);
  }

  function nextSet() {
    if (sets >= BASE_SETS) {
      finishWorkout();
      return;
    }
    setSets(s => s + 1);
    setState("active_set");
  }

  function finishWorkout() {
    setState("completed");

    const duration =
      startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : 0;

    const avgForm =
      allFormScoresRef.current.length > 0
        ? allFormScoresRef.current.reduce((a,b)=>a+b,0) /
          allFormScoresRef.current.length
        : 0;

    const workout: Workout = {
      id: crypto.randomUUID(),
      exercise,
      totalSets: BASE_SETS,
      repsPerSet: targetReps,
      date: new Date().toISOString(),
      duration
    };

    const existing =
      JSON.parse(localStorage.getItem("workouts") || "[]");

    localStorage.setItem(
      "workouts",
      JSON.stringify([workout, ...existing])
    );

    setSummary({
      exercise,
      totalSets: BASE_SETS,
      finalRepsPerSet: targetReps,
      totalReps: BASE_SETS * targetReps,
      duration,
      averageFormScore: Math.round(avgForm)
    });
  }

  function resetWorkout() {
    clearInterval(restIntervalRef.current!);
    clearInterval(plankIntervalRef.current!);

    restIntervalRef.current = null;
    plankIntervalRef.current = null;

    setState("idle");
    setReps(0);
    setSets(1);
    setTargetReps(BASE_REPS);
    setRestDuration(BASE_REST);
    setRestTime(BASE_REST);
    setPlankDuration(BASE_PLANK);
    setPlankTime(0);
    setSummary(null);
    setDifficulty("moderate");

    formScoresRef.current = [];
    allFormScoresRef.current = [];
    startTimeRef.current = null;
  }

  useEffect(() => {
    return () => {
      clearInterval(restIntervalRef.current!);
      clearInterval(plankIntervalRef.current!);
    };
  }, []);

  return {
    state,
    difficulty,
    reps,
    sets,
    restTime,
    plankTime,
    targetReps,
    plankDuration,
    summary,
    startWorkout,
    completeRep,
    startPlankTimer,
    recordFormScore,
    resetWorkout
  };
}