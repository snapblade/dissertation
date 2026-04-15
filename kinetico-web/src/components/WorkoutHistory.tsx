import { useEffect, useState } from "react";
import type { Workout } from "../types/workout";

export default function WorkoutHistory() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem("workouts") || "[]");
    setWorkouts(stored);
  }, []);

  if (workouts.length === 0) {
    return (
      <div style={card}>
        <h3 style={{ marginTop: 0 }}>Workout History</h3>
        <p style={{ opacity: 0.6 }}>No workouts yet.</p>
      </div>
    );
  }

  return (
    <div style={card}>
      <h3 style={{ marginTop: 0 }}>Workout History</h3>
      {workouts.map((w) => (
        <div key={w.id} style={item}>
          <div style={{ fontWeight: 600 }}>
            {w.exercise.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            {new Date(w.date).toLocaleDateString()}
          </div>
          <div style={{ marginTop: 4 }}>
            {w.totalSets} sets × {w.repsPerSet} reps
          </div>
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Duration: {w.duration}s
          </div>
        </div>
      ))}
    </div>
  );
}

const card: React.CSSProperties = {
  marginTop: 20,
  background: "#1e293b",
  padding: 20,
  borderRadius: 16,
  border: "1px solid rgba(148,163,184,0.2)",
  color: "white",
};

const item: React.CSSProperties = {
  padding: 10,
  borderBottom: "1px solid rgba(148,163,184,0.15)",
  marginBottom: 10,
};