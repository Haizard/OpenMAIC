'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Square, Upload, Video, X } from 'lucide-react';

export type RecorderMode = 'audio' | 'video';

interface RecorderProps {
  mode: RecorderMode;
  onUploaded: () => void;
  onUpload: (blob: Blob) => Promise<void>;
  disabled?: boolean;
  /** Already has a take, so the button reads as a replacement. */
  hasRecording?: boolean;
}

type Phase = 'idle' | 'requesting' | 'recording' | 'ready';

/**
 * Record audio or video in the browser and hand the blob to the caller.
 *
 * The recording never leaves the tab until the student presses "Use this take", which keeps a
 * bad first attempt from being uploaded.
 */
export function Recorder({ mode, onUploaded, onUpload, disabled, hasRecording }: RecorderProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Release the microphone or camera if the student navigates away mid-recording.
  useEffect(
    () => () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
      stopStream();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl, stopStream],
  );

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    blobRef.current = null;
    setSeconds(0);
    setPhase('idle');
  };

  const start = async () => {
    setError(null);
    setPhase('requesting');

    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices) {
      setError('This browser cannot record. Try Chrome or Edge, or upload a file instead.');
      setPhase('idle');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: mode === 'video',
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: chunksRef.current[0]?.type || (mode === 'video' ? 'video/webm' : 'audio/webm'),
        });
        blobRef.current = blob;
        setPreviewUrl(URL.createObjectURL(blob));
        setPhase('ready');
        stopStream();
        if (timerRef.current) clearInterval(timerRef.current);
      };

      recorder.start();
      setSeconds(0);
      setPhase('recording');
      timerRef.current = setInterval(() => setSeconds((value) => value + 1), 1000);
    } catch {
      // NotAllowedError is the common case: the student dismissed the permission prompt.
      setError(
        'Microphone access was blocked. Allow it in your browser, or upload a recording instead.',
      );
      setPhase('idle');
      stopStream();
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const upload = async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setUploading(true);
    setError(null);
    try {
      await onUpload(blob);
      reset();
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const Icon = mode === 'video' ? Video : Mic;

  if (phase === 'ready' && previewUrl) {
    return (
      <div className="space-y-2">
        {mode === 'video' ? (
          <video src={previewUrl} controls className="w-full rounded-lg bg-black" />
        ) : (
          <audio src={previewUrl} controls className="w-full" />
        )}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={upload} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Use this take
          </Button>
          <Button size="sm" variant="ghost" onClick={reset} disabled={uploading}>
            <X className="w-4 h-4 mr-2" />
            Discard
          </Button>
        </div>
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-3">
        <Button size="sm" variant="destructive" onClick={stop}>
          <Square className="w-4 h-4 mr-2" />
          Stop
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {String(Math.floor(seconds / 60)).padStart(2, '0')}:
          {String(seconds % 60).padStart(2, '0')}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="outline" onClick={start} disabled={disabled || phase === 'requesting'}>
          {phase === 'requesting' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Icon className="w-4 h-4 mr-2" />
          )}
          {hasRecording ? 'Record again' : `Record ${mode === 'video' ? 'video' : 'your answer'}`}
        </Button>
        <FileUpload mode={mode} onUpload={onUpload} onUploaded={onUploaded} disabled={disabled} />
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

/** Fallback for a browser without usable capture, or a student who recorded elsewhere. */
function FileUpload({
  mode,
  onUpload,
  onUploaded,
  disabled,
}: {
  mode: RecorderMode;
  onUpload: (blob: Blob) => Promise<void>;
  onUploaded: () => void;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  return (
    <div className="flex items-center gap-2">
      <label
        className={`text-xs text-muted-foreground underline underline-offset-2 ${
          disabled || busy ? 'opacity-50 pointer-events-none' : 'cursor-pointer'
        }`}
      >
        {busy ? 'Uploading…' : 'or upload a file'}
        <input
          type="file"
          accept={mode === 'video' ? 'video/*' : 'audio/*'}
          className="hidden"
          onChange={pick}
          disabled={disabled || busy}
        />
      </label>
      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
