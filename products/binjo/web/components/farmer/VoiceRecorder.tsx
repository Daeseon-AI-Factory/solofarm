"use client";

import { useState, useRef, useCallback } from "react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

/**
 * Voice recorder component — one big button, tap to record, tap to stop.
 * Uses the browser's MediaRecorder API (works on mobile Chrome/Safari).
 *
 * The Glove Test: big button, simple state, no tiny controls.
 */
export default function VoiceRecorder({ onRecordingComplete, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          // 16kHz is Whisper's optimal sample rate
          sampleRate: 16000,
        },
      });

      // Prefer webm/opus (best compression + Whisper support)
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop());

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          onRecordingComplete(blob);
        }
      };

      recorder.start(1000); // Collect data every second
      mediaRecorderRef.current = recorder;
      setRecording(true);
      setDuration(0);

      // Timer for duration display
      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      // Microphone permission denied or not available
      alert("마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.");
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Big record button — The Glove Test */}
      <button
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled}
        className="w-32 h-32 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-lg"
        style={{
          backgroundColor: recording ? "#D4421E" : "#2D5016",
        }}
      >
        {recording ? (
          // Stop icon (square)
          <div className="w-10 h-10 rounded-md bg-white" />
        ) : (
          // Microphone icon
          <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Status text */}
      <div className="text-center">
        {recording ? (
          <>
            <div className="flex items-center gap-2 justify-center mb-1">
              <span
                className="w-3 h-3 rounded-full animate-pulse"
                style={{ backgroundColor: "#D4421E" }}
              />
              <span className="text-lg font-bold" style={{ color: "#D4421E" }}>
                녹음 중...
              </span>
            </div>
            <span className="text-2xl font-mono" style={{ color: "#1A1A1A" }}>
              {formatDuration(duration)}
            </span>
          </>
        ) : (
          <p className="text-sm" style={{ color: "#6B6B6B" }}>
            {disabled ? "처리 중..." : "버튼을 눌러 오늘 하루를 기록하세요"}
          </p>
        )}
      </div>

      {/* Tips */}
      {!recording && !disabled && (
        <div
          className="rounded-xl p-3 text-xs leading-relaxed max-w-xs"
          style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
        >
          <p className="font-semibold mb-1">이렇게 말해보세요:</p>
          <p>"오늘 3번 밭에서 전정 작업 했고, 석회유황합제 200리터 살포했어."</p>
        </div>
      )}
    </div>
  );
}
