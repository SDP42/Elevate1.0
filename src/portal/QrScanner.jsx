import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/* A plain in-browser QR reader: asks for the camera, pulls a frame onto a
   hidden canvas on every animation tick, and hands jsQR the pixels. No
   native app, no extra permission flow beyond the one browser prompt. */
export default function QrScanner({ onDecode, paused }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const pausedRef = useRef(paused);
  const onDecodeRef = useRef(onDecode);
  const [error, setError] = useState("");

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onDecodeRef.current = onDecode;
  }, [onDecode]);

  useEffect(() => {
    let stream;
    let cancelled = false;
    let lastFrame = 0, lastPayload = "", lastDecodedAt = 0;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        tick();
      } catch {
        if (!cancelled) {
          setError("Camera access was denied or isn't available. Allow camera access and reload.");
        }
      }
    }

    function tick(time = 0) {
      frameRef.current = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (time - lastFrame < 100) return;
      lastFrame = time;
      if (pausedRef.current || !video || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const scale = Math.min(1, 960 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(frame.data, frame.width, frame.height);
      if (code?.data && (code.data !== lastPayload || time - lastDecodedAt > 2000)) {
        lastPayload = code.data; lastDecodedAt = time;
        onDecodeRef.current(code.data);
      }
    }

    start();
    return () => {
      cancelled = true;
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) return <p className="portal-auth__error">{error}</p>;

  return (
    <div className="portal-scanner">
      <video ref={videoRef} className="portal-scanner__video" playsInline muted />
      <canvas ref={canvasRef} className="portal-scanner__canvas" />
      <div className="portal-scanner__frame" aria-hidden="true" />
    </div>
  );
}
