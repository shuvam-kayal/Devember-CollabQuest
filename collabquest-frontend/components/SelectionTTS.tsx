"use client";

import { useEffect, useRef, useState } from "react";

export default function SelectionTTS() {
  // Start with a deterministic value to avoid SSR/client hydration mismatch.
  const [enabled, setEnabled] = useState<boolean>(false);

  // Sync from localStorage after mount.
  useEffect(() => {
    try {
      const v = localStorage.getItem("ttsEnabled");
      if (v === "true") setEnabled(true);
    } catch {}
  }, []);

  // track whether we've synced initial value from storage to avoid
  // writing the default `false` back over an existing `true` value.
  const initializedRef = useRef<boolean>(false);

  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    try {
      if (!initializedRef.current) return;
      localStorage.setItem("ttsEnabled", enabled ? "true" : "false");
    } catch {}
  }, [enabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const speakSelection = () => {
      if (!enabled) return;
      if (typeof window === "undefined" || !window.getSelection) return;
      const selection = window.getSelection();
      const text = selection ? selection.toString().trim() : "";
      if (!text) return;

      // cancel any existing speech
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
        } catch {}
      }

      try {
        const utter = new SpeechSynthesisUtterance(text);
        utterRef.current = utter;
        if (typeof window !== "undefined" && window.speechSynthesis) {
          window.speechSynthesis.speak(utter);
        }
      } catch (e) {
        // ignore
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          try {
            if (window.speechSynthesis.speaking) window.speechSynthesis.cancel();
          } catch {}
        }
      }
    };

    // react to storage changes from settings page in other tabs
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === "ttsEnabled") {
        setEnabled(ev.newValue === "true");
        initializedRef.current = true;
      }
    };

    // react to in-window custom events (fired by settings page)
    const onCustom = (ev: Event) => {
      try {
        const custom = ev as CustomEvent<boolean>;
        if (typeof custom.detail === "boolean") {
          setEnabled(custom.detail);
          initializedRef.current = true;
        }
      } catch {}
    };

    document.addEventListener("mouseup", speakSelection);
    document.addEventListener("pointerup", speakSelection);
    document.addEventListener("touchend", speakSelection);
    document.addEventListener("selectionchange", speakSelection);
    document.addEventListener("keyup", onKey);
    window.addEventListener("storage", onStorage);
    window.addEventListener("ttsChanged", onCustom as EventListener);

    return () => {
      document.removeEventListener("mouseup", speakSelection);
      document.removeEventListener("pointerup", speakSelection);
      document.removeEventListener("touchend", speakSelection);
      document.removeEventListener("selectionchange", speakSelection);
      document.removeEventListener("keyup", onKey);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("ttsChanged", onCustom as EventListener);
    };
  }, [enabled]);

  // This component has no visible UI; it exposes a small floating indicator when enabled.
  return (
    <div aria-hidden style={{ position: "fixed", right: 12, bottom: 12 }}>
      {enabled ? (
        <div
          title="Text-to-Speech enabled: select text to hear it"
          style={{
            background: "#0f172a",
            color: "#fff",
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 12,
            boxShadow: "0 2px 8px rgba(2,6,23,0.4)",
          }}
        >
          TTS: On
        </div>
      ) : null}
    </div>
  );
}
