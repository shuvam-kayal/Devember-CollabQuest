"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";

export default function SettingsPage() {
  // deterministic initial state to avoid SSR/client mismatch
  const [tts, setTts] = useState<boolean>(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    // gate access to settings behind a token
    try {
      const token = Cookies.get("token");
      setAllowed(!!token);
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    try {
      const v = localStorage.getItem("ttsEnabled");
      if (v === "true") setTts(true);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ttsEnabled", tts ? "true" : "false");
      // notify SelectionTTS in same tab via custom event
      window.dispatchEvent(new CustomEvent("ttsChanged", { detail: tts }));
    } catch {}
  }, [tts]);

  if (allowed === null) return null; // still checking

  if (!allowed) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Settings</h1>
        <p style={{ marginTop: 12 }}>
          You must <Link href="/login">sign in</Link> to access settings.
        </p>
      </main>
    );
  }

  return (
    <main style={{ padding: 24 }}>
      <h1>Settings</h1>
      <section style={{ marginTop: 16 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={tts}
            onChange={(e) => setTts(e.target.checked)}
          />
          Enable Selection Text-to-Speech
        </label>
        <p style={{ marginTop: 8, color: "#6b7280" }}>
          When enabled, selecting text anywhere in the app will cause your
          browser to read it aloud. Press <strong>Escape</strong> to cancel.
        </p>
      </section>
    </main>
  );
}
