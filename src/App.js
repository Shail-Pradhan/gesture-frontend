import React, { useRef, useEffect, useState, useCallback } from "react";
import "./App.css";

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [gesture, setGesture] = useState("Waiting...");
  const [detectionEnabled, setDetectionEnabled] = useState(true);
  const [fps, setFps] = useState(0);
  const gestureRef = useRef("Waiting...");
  const lastFrameTime = useRef(0);
  const frameCount = useRef(0);
  const lastFpsUpdateTime = useRef(performance.now());

  const isMobile = window.innerWidth < 768;

  const captureAndSendFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !canvas || !ctx) return;

    const aspectRatio = video.videoWidth / video.videoHeight;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (isMobile) {
      const maxDimension = Math.max(window.innerWidth, window.innerHeight);
      if (width > maxDimension) {
        width = maxDimension;
        height = width / aspectRatio;
      }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(video, 0, 0, width, height);

    const imageData = canvas.toDataURL("image/jpeg", 0.5);

    try {
      const response = await fetch("https://gesture-backend-7vfo.onrender.com/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });

      const result = await response.json();

      if (result.gesture !== gestureRef.current) {
        gestureRef.current = result.gesture;
        setGesture(result.gesture);
      }
    } catch (error) {
      console.error("Error sending frame:", error);
      setGesture("Error");
    }
  }, [isMobile]);

  useEffect(() => {
    const handleResize = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty("--vh", `${vh}px`);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    let animationId;

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });

        const video = videoRef.current;
        video.srcObject = stream;

        video.onloadedmetadata = () => {
          video.play().then(() => {
            animationId = requestAnimationFrame(loop);
          });
        };
      } catch (err) {
        console.error("Camera setup failed:", err);
        setGesture("Camera Error");
      }
    };

    const loop = (timestamp) => {
      if (detectionEnabled && timestamp - lastFrameTime.current > 1500) {
        captureAndSendFrame();
        lastFrameTime.current = timestamp;
      }

      frameCount.current++;
      const now = performance.now();
      if (now - lastFpsUpdateTime.current >= 1000) {
        setFps(frameCount.current);
        frameCount.current = 0;
        lastFpsUpdateTime.current = now;
      }

      animationId = requestAnimationFrame(loop);
    };

    setupCamera();

    const currentVideo = videoRef.current;
    return () => {
      if (animationId) cancelAnimationFrame(animationId);
      if (currentVideo?.srcObject) {
        currentVideo.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, [detectionEnabled, captureAndSendFrame]); // ✅ now includes captureAndSendFrame

  return (
    <div className="App">
      <div className="content">
        {isMobile && <h2 className="mobile-title">Gesture Recognition</h2>}

        <div className="video-container">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="video-feed"
          />
        </div>

        <canvas ref={canvasRef} style={{ display: "none" }} />

        <p className="info-text">
          <strong>Gesture:</strong> {gesture}
        </p>
        <p className="info-text">
          <strong>FPS:</strong> {fps}
        </p>
      </div>

      <div className="bottom-bar">
        <button
          onClick={() => setDetectionEnabled((prev) => !prev)}
          className="toggle-btn"
        >
          {detectionEnabled ? "Stop Detection" : "Start Detection"}
        </button>
      </div>
    </div>
  );
}

export default App;
