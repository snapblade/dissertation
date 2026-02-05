import { useEffect, useRef } from "react";
import {
  FilesetResolver,
  PoseLandmarker
} from "@mediapipe/tasks-vision";

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let landmarker: PoseLandmarker;

    async function setup() {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
      );

      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
        },
        runningMode: "VIDEO",
      });

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      requestAnimationFrame(loop);
    }

    async function loop() {
      if (!videoRef.current || !canvasRef.current) return;

      const results = landmarker.detectForVideo(
        videoRef.current,
        performance.now()
      );

      const ctx = canvasRef.current.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, 640, 480);

      if (results.landmarks.length > 0) {
        const landmarks = results.landmarks[0];

        ctx.fillStyle = "lime";

        landmarks.forEach((lm) => {
          ctx.beginPath();
          ctx.arc(lm.x * 640, lm.y * 480, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      }

      requestAnimationFrame(loop);
    }

    setup();
  }, []);

  return (
    <>
      <video ref={videoRef} style={{ display: "none" }} />
      <canvas ref={canvasRef} width={640} height={480} />
    </>
  );
}
