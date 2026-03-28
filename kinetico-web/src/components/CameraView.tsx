import { forwardRef } from "react";

const CameraView = forwardRef<HTMLVideoElement>((_props, ref) => {
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      style={{ width: "100%", borderRadius: 16 }}
    />
  );
});

CameraView.displayName = "CameraView";

export default CameraView;