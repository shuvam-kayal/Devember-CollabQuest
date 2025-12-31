"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import Link from "next/link";
import { Loader2, Volume2, ArrowLeft, AlertTriangle, Trash2 } from "lucide-react";
import api from "@/lib/api";

export default function SettingsClient() {
  // deterministic initial state to avoid SSR/client mismatch
  const [tts, setTts] = useState<boolean>(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
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
      window.dispatchEvent(new CustomEvent("ttsChanged", { detail: tts }));
    } catch {}
  }, [tts]);

  // --- DELETE ACCOUNT HANDLER ---
  const handleDeleteAccount = async () => {
    const confirmation = window.prompt("Type 'DELETE' to confirm permanent account deletion. This cannot be undone.");
    if (confirmation !== "DELETE") return;

    try {
        await api.delete("/users/me");
        Cookies.remove("token");
        window.location.href = "/";
    } catch (err: any) {
        alert(err.response?.data?.detail || "Failed to delete account.");
    }
  }

  if (allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <main className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent mb-4">Access Denied</h1>
        <p className="text-gray-400 mb-6">
          You must be logged in to access your settings.
        </p>
        <Link 
          href="/" 
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold py-2 px-6 rounded-full transition"
        >
          Go Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-transparent text-zinc-100 font-sans selection:bg-purple-500/30 relative overflow-hidden">
      <div className="max-w-4xl mx-auto px-6 py-12">
        
        {/* Header Section */}
        <div className="mb-8">
            <Link href="/dashboard" className="inline-flex items-center text-gray-400 hover:text-white mb-4 transition">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
            </Link>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-gray-400 mt-2">Manage your preferences and accessibility options.</p>
        </div>

        {/* Accessibility Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl mb-8">
            <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-4">
                <Volume2 className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold">Accessibility</h2>
            </div>

            <div className="flex items-center justify-between">
                <div className="pr-4">
                    <h3 className="text-base font-medium text-gray-200">Selection Text-to-Speech</h3>
                    <p className="text-sm text-gray-400 mt-1 leading-relaxed">
                        When enabled, selecting text anywhere in the app will cause your browser to read it aloud. 
                        Useful for proofreading or accessibility.
                    </p>
                </div>

                {/* Styled Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                        type="checkbox"
                        checked={tts}
                        onChange={(e) => setTts(e.target.checked)}
                        className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500/50 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-800/50">
                <p className="text-xs text-gray-500 flex items-center gap-2">
                    <span className="bg-gray-800 px-1.5 py-0.5 rounded text-gray-300 font-mono">ESC</span> 
                    Press Escape key at any time to stop reading immediately.
                </p>
            </div>
        </div>

        {/* DANGER ZONE (NEW) */}
        <div className="bg-gray-900 border border-red-900/30 rounded-2xl p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4 border-b border-red-900/30 pb-4">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-red-500">Danger Zone</h2>
            </div>
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
                Permanently remove your account and all associated data. This action is irreversible. 
                <br /><span className="text-red-400 italic">Note: You must leave all active and planning projects before you can delete your account.</span>
            </p>
            <button 
                onClick={handleDeleteAccount}
                className="bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-600 font-bold py-3 px-6 rounded-xl transition flex items-center gap-2"
            >
                <Trash2 className="w-4 h-4" /> Delete Account
            </button>
        </div>

      </div>
    </main>
  );
}
