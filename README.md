# Kinetico — Web Pose Trainer

A browser-based fitness coaching application that uses real-time pose estimation to provide form correction, adaptive difficulty, and voice coaching for squats, push-ups, and planks. All processing runs on-device — no server, no data leaves your machine.

## Features

- Real-time pose tracking via MediaPipe Pose (WebAssembly)
- 8 biomechanical form checks across 3 exercises
- Automatic exercise detection (no manual switching needed)
- Adaptive difficulty that promotes/demotes based on form quality
- Priority-based voice coaching
- Repetition counting with depth validation
- Local workout history

## Tech Stack

- React 18 + TypeScript
- Vite
- MediaPipe Pose Landmarker (WASM, loaded from CDN)
- Web Speech API

## Prerequisites

- **Node.js** (v18 or later recommended)
- **npm** (comes with Node.js)
- A device with a **webcam**
- A modern browser (Chrome, Edge, or Safari recommended)

## Getting Started

1. **Clone the repository**

   ```bash
   git clone https://github.com/<snapbalde>/kinetico-web.git
   cd kinetico-web
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   ```

4. **Open the app**

   Vite will print a local URL (usually `http://localhost:5173`). Open it in your browser.

5. **Allow camera access** when prompted by the browser.

6. **Step into frame** — a 3-second countdown will begin, then the workout starts automatically.

## Project Structure

```
src/
├── components/
│   ├── CameraView.tsx          # Webcam video element
│   ├── StatsPanel.tsx          # Live stats display (reps, angle, form, difficulty)
│   ├── WorkoutHistory.tsx      # Past workout list (from localStorage)
│   └── WorkoutSummaryModal.tsx # End-of-workout summary
├── hooks/
│   ├── usePoseEngine.ts        # Layer 1 — MediaPipe pose detection
│   ├── useExerciseAnalyzer.ts  # Layer 2 — Angle calculation, form checks, auto-detect
│   ├── useWorkoutEngine.ts     # Layer 3 — Reps, sets, difficulty, state machine
│   └── useVoiceCoach.ts        # Priority-based voice feedback
├── pose/
│   └── math.ts                 # Angle calculation utility
├── types/
│   └── workout.ts              # TypeScript type definitions
├── App.tsx                     # Orchestrator — wires all layers together
├── App.css
├── index.css
└── main.tsx                    # Entry point
```

## How It Works

1. **Vision layer** (`usePoseEngine`) captures webcam frames and runs MediaPipe Pose to extract 33 skeletal landmarks.
2. **Analysis layer** (`useExerciseAnalyzer`) computes joint angles, runs form checks against difficulty-scaled thresholds, and auto-detects which exercise is being performed.
3. **Workout engine** (`useWorkoutEngine`) counts reps, manages sets and rest periods, and adapts difficulty between sets based on form score averages.
4. **App.tsx** orchestrates data flow between layers and triggers voice coaching via `useVoiceCoach`.

## Usage Tips

- **Exercise selection**: The app auto-detects your exercise, but you can also manually select Squat, Push-up, or Plank using the buttons above the camera feed.
- **Voice toggle**: Click the Voice button in the header to mute/unmute audio coaching.
- **Pause**: Click the Pause button below the camera feed to pause tracking.
- **Workout history**: Completed workouts are saved in your browser's local storage and displayed on the right panel.

## Browser Support


Chrome
Edge
Safari 


## Licence

This project was developed as an undergraduate dissertation at the University of Stirling.
