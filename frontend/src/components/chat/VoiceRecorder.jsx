import React, { useRef, useState } from 'react';

export default function VoiceRecorder({ onComplete, className = "btn btn-sm", idleLabel = "Record Voice", recordingLabel = "Stop" }) {
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(null);
  const [recording, setRecording] = useState(false);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      recorderRef.current = mr;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      mr.ondataavailable = (e) => { if (e.data && e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const duration_seconds = startedAtRef.current
          ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000))
          : 1;
        onComplete && onComplete({ blob, duration_seconds });
        stream.getTracks().forEach(t => t.stop());
        startedAtRef.current = null;
      };
      mr.start();
      setRecording(true);
    } catch (e) {
      console.error('VoiceRecorder start failed', e);
    }
  };

  const stop = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    setRecording(false);
  };

  return (
    <div>
      <button type="button" onClick={recording ? stop : start} className={className}>
        {recording ? recordingLabel : idleLabel}
      </button>
    </div>
  );
}
