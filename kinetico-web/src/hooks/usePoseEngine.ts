import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export function usePoseEngine(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  running: boolean
) {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const runningRef = useRef(running);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);
  const [ready, setReady] = useState(false);

  // keep ref in sync
  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  useEffect(() => {
    let active = true;

    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
        },
        runningMode: "VIDEO",
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setReady(true);
      requestAnimationFrame(loop);
    }

    function loop() {
      if (!active || !videoRef.current || !landmarkerRef.current) return;

      if (!runningRef.current) {
        setLandmarks(null);
        requestAnimationFrame(loop);
        return;
      }

      const res = landmarkerRef.current.detectForVideo(
        videoRef.current,
        performance.now()
      );

      if (res.landmarks.length > 0) {
        setLandmarks([...res.landmarks[0]]);
      } else {
        setLandmarks(null);
      }

      requestAnimationFrame(loop);
    }

    setup();

    return () => {
      active = false;
    };
  }, []);

  return { landmarks, ready };
}