"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  disabled?: boolean;
}

function microphoneErrorMessage(error: unknown): string {
  if (!(error instanceof DOMException)) {
    return "녹음을 시작하지 못했습니다. 브라우저를 새로고침한 뒤 다시 시도해주세요.";
  }

  switch (error.name) {
    case "NotAllowedError":
      return "마이크 권한이 차단되었습니다. 주소창의 자물쇠 아이콘에서 마이크를 허용한 뒤 다시 눌러주세요.";
    case "NotFoundError":
      return "사용 가능한 마이크를 찾을 수 없습니다. 기기의 마이크 연결을 확인해주세요.";
    case "NotReadableError":
      return "다른 앱이 마이크를 사용 중일 수 있습니다. 다른 앱의 녹음을 종료한 뒤 다시 시도해주세요.";
    case "SecurityError":
      return "이 주소에서는 마이크를 사용할 수 없습니다. HTTPS 주소 또는 localhost에서 열어주세요.";
    default:
      return "마이크를 시작하지 못했습니다. 브라우저의 마이크 권한을 확인한 뒤 다시 시도해주세요.";
  }
}

/** One-button recorder with explicit resource cleanup and recoverable errors. */
export default function VoiceRecorder({ onRecordingComplete, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const shouldDeliverRef = useRef(false);
  const mountedRef = useRef(true);
  const disabledRef = useRef(Boolean(disabled));

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    if (disabled || recording) return;

    setError(null);

    if (
      typeof window === "undefined" ||
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setError("이 브라우저는 음성 녹음을 지원하지 않습니다. 최신 Chrome 또는 Safari에서 다시 열어주세요.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      if (!mountedRef.current || disabledRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      const supportedMimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = supportedMimeType
        ? new MediaRecorder(stream, { mimeType: supportedMimeType })
        : new MediaRecorder(stream);
      const outputMimeType = recorder.mimeType || supportedMimeType || "audio/webm";

      chunksRef.current = [];
      shouldDeliverRef.current = true;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        shouldDeliverRef.current = false;
        clearTimer();
        releaseStream();
        mediaRecorderRef.current = null;
        if (mountedRef.current) {
          setRecording(false);
          setError("녹음 중 오류가 발생했습니다. 마이크 연결을 확인한 뒤 다시 시도해주세요.");
        }
      };

      recorder.onstop = () => {
        const shouldDeliver = shouldDeliverRef.current;
        shouldDeliverRef.current = false;
        clearTimer();
        releaseStream();
        mediaRecorderRef.current = null;

        if (!mountedRef.current) return;

        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: outputMimeType });
        chunksRef.current = [];
        if (shouldDeliver && blob.size > 0) {
          onRecordingComplete(blob);
        } else if (shouldDeliver) {
          setError("녹음된 내용이 없습니다. 마이크가 켜져 있는지 확인한 뒤 다시 녹음해주세요.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        setDuration((current) => current + 1);
      }, 1000);
    } catch (caught) {
      shouldDeliverRef.current = false;
      clearTimer();
      releaseStream();
      mediaRecorderRef.current = null;
      if (mountedRef.current) {
        setRecording(false);
        setError(microphoneErrorMessage(caught));
      }
    }
  }, [clearTimer, disabled, onRecordingComplete, recording, releaseStream]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") {
      recorder.stop();
      return;
    }

    shouldDeliverRef.current = false;
    clearTimer();
    releaseStream();
    setRecording(false);
  }, [clearTimer, releaseStream]);

  useEffect(() => {
    disabledRef.current = Boolean(disabled);
    if (!disabled || !recording) return;

    shouldDeliverRef.current = false;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
  }, [disabled, recording]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      shouldDeliverRef.current = false;
      clearTimer();

      const recorder = mediaRecorderRef.current;
      if (recorder) {
        recorder.ondataavailable = null;
        recorder.onerror = null;
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
      }

      mediaRecorderRef.current = null;
      chunksRef.current = [];
      releaseStream();
    };
  }, [clearTimer, releaseStream]);

  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        type="button"
        onClick={recording ? stopRecording : startRecording}
        disabled={disabled}
        aria-label={recording ? "녹음 중지" : "음성 기록 시작"}
        className="w-32 h-32 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 shadow-lg"
        style={{ backgroundColor: recording ? "#D4421E" : "#2D5016" }}
      >
        {recording ? (
          <div className="w-10 h-10 rounded-md bg-white" />
        ) : (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="white" aria-hidden="true">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      <div className="text-center">
        {recording ? (
          <>
            <div className="flex items-center gap-2 justify-center mb-1">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: "#D4421E" }} />
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

      {error && (
        <div
          role="alert"
          className="max-w-xs rounded-xl p-3 text-sm leading-relaxed"
          style={{ backgroundColor: "#FEF3E2", color: "#D4421E" }}
        >
          {error}
        </div>
      )}

      {!recording && !disabled && (
        <div
          className="rounded-xl p-3 text-xs leading-relaxed max-w-xs"
          style={{ backgroundColor: "#EDF4E8", color: "#2D5016" }}
        >
          <p className="font-semibold mb-1">이렇게 말해보세요:</p>
          <p>&quot;오늘 3번 밭에서 전정 작업 했고, 석회유황합제 200리터 살포했어.&quot;</p>
        </div>
      )}
    </div>
  );
}
