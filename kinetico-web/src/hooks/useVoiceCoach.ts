import { useRef } from "react";

/* ───────────────────────────────────────
   PRIORITY LEVELS (lower number = higher priority)
   
   1. Form corrections — safety/technique
   2. Workout state    — set complete, workout complete
   3. Motivational     — almost done, good form
   4. Rep count        — 1, 2, 3...
─────────────────────────────────────── */

export type VoicePriority = 1 | 2 | 3 | 4;

const MIN_GAP_MS = 800;

export function useVoiceCoach(enabled: boolean) {
  const lastSpokenRef = useRef<string | null>(null);
  const busyUntilRef = useRef(0);
  const currentPriorityRef = useRef<VoicePriority | null>(null);

  function speak(text: string, priority: VoicePriority = 4) {
    if (!enabled) return;

    const now = Date.now();
    const isBusy = now < busyUntilRef.current;

    if (isBusy) {
      // higher priority (lower number) interrupts current speech
      if (currentPriorityRef.current !== null && priority < currentPriorityRef.current) {
        speechSynthesis.cancel();
      } else {
        // same or lower priority — drop it
        return;
      }
    }

    // same message back-to-back — skip
    if (lastSpokenRef.current === text && isBusy) return;

    speechSynthesis.cancel();

    const u = new SpeechSynthesisUtterance(text);
    currentPriorityRef.current = priority;

    // estimate duration
    const estimatedMs = text.length * 120 + 400;
    busyUntilRef.current = now + Math.max(estimatedMs, MIN_GAP_MS);

    u.onend = () => {
      busyUntilRef.current = Date.now() + 300;
      currentPriorityRef.current = null;
    };

    u.onerror = () => {
      busyUntilRef.current = Date.now() + 300;
      currentPriorityRef.current = null;
    };

    speechSynthesis.speak(u);
    lastSpokenRef.current = text;
  }

  function resetVoiceMemory() {
    lastSpokenRef.current = null;
  }

  return { speak, resetVoiceMemory };
}