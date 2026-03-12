import { useEffect, useRef, useState } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

export function usePoseEngine(running: boolean) {

  const videoRef = useRef<HTMLVideoElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const [landmarks, setLandmarks] = useState<any[] | null>(null);

  useEffect(() => {

    let active = true;

    async function setup() {

      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      landmarkerRef.current =
        await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task"
          },
          runningMode: "VIDEO"
        });

      const stream =
        await navigator.mediaDevices.getUserMedia({ video: true });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      requestAnimationFrame(loop);
    }

    function loop() {

      if (!active || !videoRef.current || !landmarkerRef.current) return;

      if (!running) {
        requestAnimationFrame(loop);
        return;
      }

      const res =
        landmarkerRef.current.detectForVideo(
          videoRef.current,
          performance.now()
        );

      if (res.landmarks.length > 0) {
        setLandmarks(res.landmarks[0]);
      }

      requestAnimationFrame(loop);
    }

    setup();

    return () => {
      active = false;
    };

  }, [running]);

  return { videoRef, landmarks };
}