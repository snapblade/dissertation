import { useRef } from "react";

export function useVoiceCoach(enabled: boolean) {

  const lastSpokenRef = useRef<string | null>(null);

  function speak(text: string) {
    if (!enabled) return;
    if (lastSpokenRef.current === text) return;

    const u = new SpeechSynthesisUtterance(text);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);

    lastSpokenRef.current = text;
  }

  function resetVoiceMemory() {
    lastSpokenRef.current = null;
  }

  return { speak, resetVoiceMemory };
}