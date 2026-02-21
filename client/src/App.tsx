import React, { useState, useRef, useCallback } from 'react';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera API not supported in this browser.');
      return;
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (error) {
      alert('Error accessing camera: ' + error);
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    setCapturedPhoto(dataUrl);
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 space-y-6">
      <h1 className="text-3xl font-bold">A&T Production Studios</h1>
      <div className="flex flex-col items-center space-y-4">
        <video ref={videoRef} className="rounded-md border border-gray-300" width={640} height={480} autoPlay muted />
        <div className="space-x-4">
          {!stream ? (
            <button onClick={startCamera} className="btn-primary">Start Camera</button>
          ) : (
            <>
              <button onClick={capturePhoto} className="btn-secondary">Capture Photo</button>
              <button onClick={stopCamera} className="btn-danger">Stop Camera</button>
            </>
          )}
        </div>
      </div>
      {capturedPhoto && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">Captured Photo Preview:</h2>
          <img src={capturedPhoto} alt="Captured" className="rounded-md border border-gray-300 mt-2 max-w-full max-h-96" />
        </div>
      )}
    </main>
  );
}
