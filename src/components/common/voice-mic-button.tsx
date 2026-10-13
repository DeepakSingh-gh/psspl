"use client";

import React, { useState, useRef } from "react";
import { transcribeSpeech } from "@/lib/api";

interface VoiceMicButtonProps {
  onTranscript: (text: string) => void;
  title?: string;
  className?: string;
}

export function VoiceMicButton({ onTranscript, title = "Click to speak & search", className = "" }: VoiceMicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);

  const startRecording = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Try Web Speech API first for instant response
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onstart = () => {
          setIsRecording(true);
        };

        recognition.onresult = (event: any) => {
          const current = event.resultIndex;
          const transcriptText = event.results[current][0].transcript;
          if (transcriptText) {
            onTranscript(transcriptText);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("[VoiceMic] Web Speech API error, falling back to OpenAI Whisper:", event.error);
          recognition.stop();
          fallbackToWhisperRecorder();
        };

        recognition.onend = () => {
          setIsRecording(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn("[VoiceMic] Web Speech init failed, using OpenAI Whisper fallback", err);
      }
    }

    // Fallback or native MediaRecorder for OpenAI Whisper
    await fallbackToWhisperRecorder();
  };

  const fallbackToWhisperRecorder = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        if (audioBlob.size > 0) {
          setIsLoading(true);
          try {
            const text = await transcribeSpeech(audioBlob);
            if (text) {
              onTranscript(text);
            }
          } catch (err: any) {
            console.error("[VoiceMic] OpenAI STT error:", err);
            const msg = err?.message || "Speech transcription failed.";
            alert(`Voice Search Notice: ${msg}`);
          } finally {
            setIsLoading(false);
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("[VoiceMic] Microphone access denied or unsupported:", err);
      alert("Microphone permission denied or unsupported browser.");
    }
  };

  const stopRecording = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  return (
    <button
      type="button"
      className={`voice-mic-btn ${isRecording ? "is-recording" : ""} ${isLoading ? "is-loading" : ""} ${className}`}
      onClick={isRecording ? stopRecording : startRecording}
      title={isRecording ? "Listening… Click to stop" : isLoading ? "Transcribing with OpenAI…" : title}
      aria-label={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isRecording ? "#CC1818" : "transparent",
        color: isRecording ? "#ffffff" : "#7A00DF",
        border: "none",
        borderRadius: "50%",
        width: "32px",
        height: "32px",
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        boxShadow: isRecording ? "0 0 0 4px rgba(204, 24, 24, 0.3)" : "none",
        animation: isRecording ? "voicePulse 1.2s infinite ease-in-out" : "none",
        padding: 0,
        margin: "0 4px",
      }}
    >
      {isLoading ? (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          stroke="currentColor"
          strokeWidth="2.5"
          fill="none"
          style={{ animation: "spin 1s linear infinite" }}
        >
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="22" />
        </svg>
      )}
      <style jsx global>{`
        @keyframes voicePulse {
          0% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(204, 24, 24, 0.5);
          }
          70% {
            transform: scale(1.08);
            box-shadow: 0 0 0 8px rgba(204, 24, 24, 0);
          }
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(204, 24, 24, 0);
          }
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </button>
  );
}
