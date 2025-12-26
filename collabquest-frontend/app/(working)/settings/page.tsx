"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Loader2, Volume2, ArrowLeft, Bell, Shield } from "lucide-react";
import { Toaster, toast } from "sonner";

export default function SettingsPage() {
  const [tts, setTts] = useState<boolean>(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  // --- MOUSE EFFECT ---
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
  }, []);

  // --- AUTH CHECK ---
  useEffect(() => {
    try {
      const token = Cookies.get("token");
      setAllowed(!!token);
    } catch {
      setAllowed(false);
    }
  }, []);

  // --- LOAD SETTINGS ---
  useEffect(() => {
    try {
      const v = localStorage.getItem("ttsEnabled");
      if (v === "true") setTts(true);
    } catch {}
  }, []);

  // --- SAVE SETTINGS HANDLER ---
  const handleToggleTts = (checked: boolean) => {
    setTts(checked);
    try {
      localStorage.setItem("ttsEnabled", checked ? "true" : "false");
      window.dispatchEvent(new CustomEvent("ttsChanged", { detail: checked }));
      toast.success(checked ? "Text-to-Speech Enabled" : "Text-to-Speech Disabled");
    } catch {
      toast.error("Failed to save setting");
    }
  };

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center text-white bg-transparent">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-4">Access Denied</h1>
        <p className="text-zinc-400 mb-6">You must be logged in to access settings.</p>
        <Link href="/" className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-full transition">Go Home</Link>
      </main>
    );
  }

  return (
    <div className="min-h-screen w-full relative overflow-hidden font-sans selection:bg-purple-500/30 flex items-center justify-center p-6">
      <Toaster position="bottom-right" theme="dark" richColors />

      {/* 2. MOUSE GLOW */}
      <div 
        className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
        style={{ background: `radial-gradient(800px at ${mousePosition.x}px ${mousePosition.y}px, rgba(147, 51, 234, 0.1), transparent 80%)` }}
      />

      {/* 3. STATIC BACKGROUND AMBIENCE */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[60%] bg-purple-900/10 blur-[100px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full mix-blend-screen" />
      </div>

      {/* 4. MAIN CONTENT CARD */}
      <div className="relative z-10 w-full max-w-3xl -mt-32">
            
            {/* Header */}
            <div className="mb-8 text-center md:text-left">
                <Link href="/dashboard" className="inline-flex items-center text-zinc-500 hover:text-white mb-4 transition group">
                    <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Dashboard
                </Link>
                <h1 className="text-4xl font-black text-white tracking-tight mb-2">Settings</h1>
                <p className="text-zinc-400 text-lg">Manage your preferences and accessibility.</p>
            </div>

            <div className="space-y-6">
                
                {/* SETTINGS GROUP: ACCESSIBILITY */}
                <div className="bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
                    <div className="flex items-center gap-4 mb-6 border-b border-white/5 pb-6">
                        <div className="p-3 bg-purple-500/10 rounded-xl">
                            <Volume2 className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Accessibility</h2>
                            <p className="text-sm text-zinc-500">Customize your experience.</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between group">
                        <div className="pr-8">
                            <h3 className="text-base font-medium text-zinc-200 group-hover:text-purple-300 transition-colors">Selection Text-to-Speech</h3>
                            <p className="text-sm text-zinc-400 mt-1 leading-relaxed">
                                Automatically read selected text aloud.
                            </p>
                            <div className="mt-2 flex items-center gap-2">
                                <span className="text-[10px] bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700">Shortcut: ESC to stop</span>
                            </div>
                        </div>

                        {/* Toggle Switch */}
                        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                            <input
                                type="checkbox"
                                checked={tts}
                                onChange={(e) => handleToggleTts(e.target.checked)}
                                className="sr-only peer"
                            />
                            <div className="w-14 h-8 bg-zinc-800 peer-focus:outline-none border border-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-zinc-400 peer-checked:after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-600 peer-checked:border-purple-500 shadow-inner"></div>
                        </label>
                    </div>
                </div>

                {/* PLACEHOLDERS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 opacity-50 pointer-events-none select-none grayscale">
                    <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-blue-500/10 rounded-lg"><Bell className="w-5 h-5 text-blue-400" /></div>
                            <h3 className="font-bold text-zinc-300">Notifications</h3>
                        </div>
                        <p className="text-sm text-zinc-500 pl-1">Coming Soon</p>
                    </div>
                    <div className="bg-zinc-900/30 border border-white/5 rounded-3xl p-6 flex flex-col justify-center">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 bg-green-500/10 rounded-lg"><Shield className="w-5 h-5 text-green-400" /></div>
                            <h3 className="font-bold text-zinc-300">Privacy</h3>
                        </div>
                        <p className="text-sm text-zinc-500 pl-1">Coming Soon</p>
                    </div>
                </div>

            </div>
      </div>
    </div>
  );
}