"use client";

import { useEffect, useRef, useState } from "react";

export default function SelectionTTS() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const initializedRef = useRef<boolean>(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 1. Sync from localStorage on mount
  useEffect(() => {
    try {
      const v = localStorage.getItem("ttsEnabled");
      if (v === "true") setEnabled(true);
      // Mark as initialized so we don't overwrite storage immediately
      initializedRef.current = true;
    } catch {}
  }, []);

  // 2. Sync state BACK to localStorage (only after initialization)
  useEffect(() => {
    if (!initializedRef.current) return;
    try {
      localStorage.setItem("ttsEnabled", enabled ? "true" : "false");
    } catch {}
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const speakSelection = () => {
      if (!enabled) return;
      
      // Small timeout allows the selection to finalize in the browser DOM
      setTimeout(() => {
          const selection = window.getSelection();
          const text = selection ? selection.toString().trim() : "";
          if (!text) return;

          // Cancel existing speech
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
          }

          try {
            const utter = new SpeechSynthesisUtterance(text);
            utterRef.current = utter;
            window.speechSynthesis.speak(utter);
          } catch (e) {
            console.error("TTS Error:", e);
          }
      }, 10);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
         if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
      }
    };

    // Listen for storage changes (other tabs)
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "ttsEnabled") {
        setEnabled(ev.newValue === "true");
      }
    };

    // Listen for custom events (SettingsPage in same tab)
    const onCustom = (ev: Event) => {
      const custom = ev as CustomEvent<boolean>;
      if (typeof custom.detail === "boolean") {
        setEnabled(custom.detail);
      }
    };

    // EVENT LISTENERS
    // Removed 'selectionchange' to prevent stuttering
    document.addEventListener("mouseup", speakSelection);
    document.addEventListener("touchend", speakSelection);
    document.addEventListener("keyup", onKey);
    window.addEventListener("storage", onStorage);
    window.addEventListener("ttsChanged", onCustom as EventListener);

    return () => {
      document.removeEventListener("mouseup", speakSelection);
      document.removeEventListener("touchend", speakSelection);
      document.removeEventListener("keyup", onKey);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ttsChanged", onCustom as EventListener);
      // Cleanup audio on unmount
      if (typeof window !== "undefined") window.speechSynthesis.cancel();
    };
  }, [enabled]);

  // Indicator UI
  if (!enabled) return null;

  return (
    <div aria-hidden style={{ position: "fixed", right: 12, bottom: 12, zIndex: 9999 }}>
      <div
        title="Text-to-Speech enabled: select text to hear it"
        style={{
          background: "#0f172a",
          color: "#fff",
          padding: "6px 10px",
          borderRadius: 8,
          fontSize: 12,
          boxShadow: "0 2px 8px rgba(2,6,23,0.4)",
          border: "1px solid #1e293b"
        }}
      >
        TTS: On
      </div>
    </div>
  );
}