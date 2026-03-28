export type Exercise = "squat" | "pushup" | "plank";

export type Workout = {
  id: string;
  exercise: Exercise;
  totalSets: number;
  repsPerSet: number;
  date: string;
  duration: number;
};