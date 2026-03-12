export type Workout = {
  id: string;
  exercise: "squat" | "pushup" | "plank";
  totalSets: number;
  repsPerSet: number;
  date: string;
  duration: number;
};